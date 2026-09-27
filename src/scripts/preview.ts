import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { selectLatestCommittedVersionId } from "../lib/server/elevenlabs/branch.ts";

const NEON_API_BASE = "https://console.neon.tech/api/v2";
const NETLIFY_BUILD_HOOK_PREFIX = "https://api.netlify.com/build_hooks/";
const NETLIFY_SITE_NAME = "dialogbank";
const NETLIFY_SITE_ID = `${NETLIFY_SITE_NAME}.netlify.app`;
const NETLIFY_API_BASE = "https://api.netlify.com/api/v1";

// The values every preview shares, such as API keys and its own
// BETTER_AUTH_SECRET. The folder imports `prod` `/`; the values generated for
// each preview below replace whatever it holds under the same keys.
const INFISICAL_ENVIRONMENT = "prod";
const INFISICAL_PREVIEW_PATH = "/preview";

type GeneratedPreviewValues = {
	PREVIEW_BRANCH: string;
	DATABASE_URL: string;
	ELEVENLABS_AGENT_BRANCH_ID: string;
	ORIGIN: string;
};

const UP_ENVIRONMENT = [
	"NEON_API_KEY",
	"NEON_PROJECT_ID",
	"PARENT_BRANCH_ID",
	"ELEVENLABS_API_KEY",
	"ELEVENLABS_AGENT_ID",
	"ELEVENLABS_AGENT_PARENT_BRANCH_ID",
	"NETLIFY_BUILD_HOOK_URL",
];
const DOWN_ENVIRONMENT = [
	"NEON_API_KEY",
	"NEON_PROJECT_ID",
	"ELEVENLABS_API_KEY",
	"ELEVENLABS_AGENT_ID",
];

const DEPLOY_APPEAR_TIMEOUT_MS = 120_000;
const DEPLOY_TIMEOUT_MS = 20 * 60_000;
const DEPLOY_POLL_INTERVAL_MS = 5_000;
// Bounds each Netlify call, which the deadlines above cannot interrupt.
const NETLIFY_CALL_TIMEOUT_MS = 60_000;

type NeonBranch = {
	id: string;
	name: string;
};

type NeonBranchesResponse = {
	branches: NeonBranch[];
	pagination?: { next?: string; cursor?: string };
};

type NeonCreateBranchResponse = {
	branch: NeonBranch;
};

type NeonDatabasesResponse = {
	databases: { name: string; owner_name: string }[];
};

type NeonConnectionUriResponse = {
	uri: string;
};

function requireEnvironment(name: string): string {
	const value = process.env[name];
	if (!value) throw new Error(`${name} is not set`);
	return value;
}

function requireEnvironments(names: string[]): void {
	const missing = names.filter((name) => !process.env[name]);
	if (missing.length > 0) throw new Error(`Missing environment variables: ${missing.join(", ")}`);
}

function readJson(path: string): Record<string, unknown> | undefined {
	try {
		return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
	} catch {
		return undefined;
	}
}

function git(...args: string[]): string {
	return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function infisical(...args: string[]): string {
	return execFileSync("infisical", [...args, "--silent"], {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "inherit"],
	}).trim();
}

// Netlify serves a branch deploy at `<branch>--<site>.netlify.app`. Rather than
// guess how Netlify rewrites other characters, only accept names that are
// already valid as that DNS label, so `ORIGIN` is guaranteed to match.
function validateBranchName(branch: string): void {
	if (branch === "main" || branch === "HEAD") {
		throw new Error(`Refusing to set up a preview for "${branch}"`);
	}
	if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(branch)) {
		throw new Error(
			`Branch "${branch}" must consist of lowercase letters, digits and single dashes to be used as a Netlify subdomain`,
		);
	}
	const label = `${branch}--${NETLIFY_SITE_NAME}`;
	if (label.length > 63) {
		throw new Error(`"${label}" exceeds the 63 character limit of a DNS label`);
	}
}

// The build hook builds whatever the remote branch points to, so a local commit
// that was never pushed would silently not be part of the preview.
function requirePushedBranch(branch: string): void {
	const remote = git("ls-remote", "origin", `refs/heads/${branch}`).split(/\s+/)[0];
	if (!remote) throw new Error(`Branch "${branch}" does not exist on origin; push it first`);
	if (remote !== git("rev-parse", "HEAD")) {
		throw new Error(`origin/${branch} is not at your local HEAD; push or pull first`);
	}
}

async function neonRequest<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(`${NEON_API_BASE}${path}`, {
		...init,
		headers: {
			Accept: "application/json",
			Authorization: `Bearer ${requireEnvironment("NEON_API_KEY")}`,
			...(init?.body ? { "Content-Type": "application/json" } : {}),
			...init?.headers,
		},
	});

	if (!response.ok) {
		throw new Error(`Neon API ${response.status}: ${await response.text()}`);
	}

	return (await response.json()) as T;
}

async function findNeonBranch(projectId: string, name: string): Promise<NeonBranch | undefined> {
	let cursor: string | undefined;
	do {
		const query = new URLSearchParams({ search: name, limit: "100" });
		if (cursor) query.set("cursor", cursor);
		const response = await neonRequest<NeonBranchesResponse>(
			`/projects/${projectId}/branches?${query}`,
		);
		const branch = response.branches.find((candidate) => candidate.name === name);
		if (branch) return branch;
		// List endpoints use `next`; Neon's older pagination schema uses `cursor`.
		const next = response.pagination?.next ?? response.pagination?.cursor;
		cursor = response.branches.length > 0 && next !== cursor ? next : undefined;
	} while (cursor);
	return undefined;
}

async function provisionNeonBranch(name: string): Promise<string> {
	const projectId = requireEnvironment("NEON_PROJECT_ID");
	const parentId = requireEnvironment("PARENT_BRANCH_ID");
	// Connect previews as the owner of the parent branch's only database, which
	// every child branch inherits.
	const { databases } = await neonRequest<NeonDatabasesResponse>(
		`/projects/${projectId}/branches/${parentId}/databases`,
	);
	const [database] = databases;
	if (!database || databases.length > 1) {
		throw new Error(`Expected exactly one database on branch ${parentId}`);
	}
	const { name: databaseName, owner_name: roleName } = database;
	let branch = await findNeonBranch(projectId, name);

	if (!branch) {
		const response = await neonRequest<NeonCreateBranchResponse>(
			`/projects/${projectId}/branches`,
			{
				method: "POST",
				body: JSON.stringify({
					branch: { name, parent_id: parentId },
					endpoints: [{ type: "read_write" }],
				}),
			},
		);
		branch = response.branch;
	}

	// Always resolve the URI explicitly: the creation response's connection_uris
	// are not guaranteed to use that database and role.
	const query = new URLSearchParams({
		branch_id: branch.id,
		database_name: databaseName,
		role_name: roleName,
		pooled: "true",
	});
	const { uri } = await neonRequest<NeonConnectionUriResponse>(
		`/projects/${projectId}/connection_uri?${query}`,
	);

	return uri;
}

async function deleteNeonBranch(name: string): Promise<void> {
	const projectId = requireEnvironment("NEON_PROJECT_ID");
	const branch = await findNeonBranch(projectId, name);
	if (!branch) return;
	await neonRequest(`/projects/${projectId}/branches/${branch.id}`, { method: "DELETE" });
}

// ElevenLabs cannot filter branches by name or page past one response, so only
// active branches are searched: archived ones pile up over time, while active
// previews stay few. Names get a timestamp so that a new branch never reuses the
// name of an archived one.
function elevenLabsBranchPrefix(branch: string): string {
	return `preview/${branch}/`;
}

async function findActiveElevenLabsBranches(
	client: ElevenLabsClient,
	agentId: string,
	branch: string,
) {
	const limit = 100;
	const { results } = await client.conversationalAi.agents.branches.list(agentId, {
		includeArchived: false,
		limit,
	});
	if (results.length >= limit) {
		throw new Error(`Agent ${agentId} has ${limit}+ active branches; archive unused ones first`);
	}
	return results.filter((candidate) => candidate.name.startsWith(elevenLabsBranchPrefix(branch)));
}

async function provisionElevenLabsBranch(branch: string): Promise<string> {
	const agentId = requireEnvironment("ELEVENLABS_AGENT_ID");
	const parentBranchId = requireEnvironment("ELEVENLABS_AGENT_PARENT_BRANCH_ID");
	const client = new ElevenLabsClient({ apiKey: requireEnvironment("ELEVENLABS_API_KEY") });

	const [existing] = await findActiveElevenLabsBranches(client, agentId, branch);
	if (existing) return existing.id;

	const parentBranch = await client.conversationalAi.agents.branches.get(agentId, parentBranchId);
	const timestamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
	const created = await client.conversationalAi.agents.branches.create(agentId, {
		parentVersionId: selectLatestCommittedVersionId(parentBranch),
		name: `${elevenLabsBranchPrefix(branch)}${timestamp}`,
		description: `Preview environment for ${branch}`,
	});
	return created.createdBranchId;
}

async function archiveElevenLabsBranches(branch: string): Promise<void> {
	const agentId = requireEnvironment("ELEVENLABS_AGENT_ID");
	const client = new ElevenLabsClient({ apiKey: requireEnvironment("ELEVENLABS_API_KEY") });

	for (const candidate of await findActiveElevenLabsBranches(client, agentId, branch)) {
		await client.conversationalAi.agents.branches.update(agentId, candidate.id, {
			isArchived: true,
		});
	}
}

// Includes the values `/preview` imports from `prod` `/`.
function readSharedPreviewValues(): Record<string, string> {
	const secrets = JSON.parse(
		infisical(
			"export",
			"--env",
			INFISICAL_ENVIRONMENT,
			"--path",
			INFISICAL_PREVIEW_PATH,
			"--format",
			"json",
		),
	) as { key: string; value: string }[];
	if (secrets.length === 0) {
		throw new Error(`Infisical ${INFISICAL_ENVIRONMENT} ${INFISICAL_PREVIEW_PATH} holds no values`);
	}
	return Object.fromEntries(secrets.map((secret) => [secret.key, secret.value]));
}

function requireBuildHookUrl(): string {
	const hookUrl = requireEnvironment("NETLIFY_BUILD_HOOK_URL");
	if (!hookUrl.startsWith(NETLIFY_BUILD_HOOK_PREFIX)) {
		throw new Error(`NETLIFY_BUILD_HOOK_URL must start with ${NETLIFY_BUILD_HOOK_PREFIX}`);
	}
	return hookUrl;
}

type NetlifyDeploy = {
	id: string;
	state: string;
	branch: string | null;
	title: string | null;
	skipped: boolean | null;
	error_message: string | null;
};

type NetlifyEnvVar = {
	key: string;
	values: { id?: string; context: string; context_parameter?: string; value?: string }[];
};

// The signed-in user's own `netlify login` session, like the Infisical CLI
// session above; no deployment credential is stored anywhere. The Netlify CLI
// has no command that prints it, so it comes from the CLI's configuration.
// Calling the API directly keeps secret values out of command-line arguments,
// which other local processes could read.
function netlifyToken(): string {
	if (process.env.NETLIFY_AUTH_TOKEN) return process.env.NETLIFY_AUTH_TOKEN;
	const configDirectory =
		process.platform === "darwin"
			? join(homedir(), "Library", "Preferences", "netlify")
			: join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "netlify");
	const config = readJson(join(configDirectory, "config.json")) as
		| { userId?: string; users?: Record<string, { auth?: { token?: string } }> }
		| undefined;
	const token = config?.userId ? config.users?.[config.userId]?.auth?.token : undefined;
	if (!token)
		throw new Error("No Netlify session found; install the Netlify CLI and run `netlify login`");
	return token;
}

async function netlifyRequest<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(`${NETLIFY_API_BASE}${path}`, {
		signal: AbortSignal.timeout(NETLIFY_CALL_TIMEOUT_MS),
		...init,
		headers: {
			Accept: "application/json",
			Authorization: `Bearer ${netlifyToken()}`,
			...(init?.body ? { "Content-Type": "application/json" } : {}),
			...init?.headers,
		},
	});
	if (!response.ok) {
		throw new Error(`Netlify API ${response.status}: ${await response.text()}`);
	}
	return (response.status === 204 ? undefined : await response.json()) as T;
}

let netlifyAccountId: string | undefined;

// Also checks that the session can read the site before anything is created.
async function requireNetlifyAccountId(): Promise<string> {
	netlifyAccountId ??= (await netlifyRequest<{ account_id: string }>(`/sites/${NETLIFY_SITE_ID}`))
		.account_id;
	return netlifyAccountId;
}

async function listEnvVars(): Promise<NetlifyEnvVar[]> {
	const accountId = await requireNetlifyAccountId();
	return netlifyRequest<NetlifyEnvVar[]>(
		`/accounts/${accountId}/env?${new URLSearchParams({ site_id: NETLIFY_SITE_ID })}`,
	);
}

function isBranchValue(value: NetlifyEnvVar["values"][number], branch: string): boolean {
	return value.context === "branch" && value.context_parameter === branch;
}

// Values for the `branch:<branch>` context apply to that branch's deploys only,
// so every preview has its own and several can exist at once. Other contexts,
// including the production values Infisical syncs, stay as they are.
async function writeBranchValues(branch: string, values: Record<string, string>): Promise<void> {
	const accountId = await requireNetlifyAccountId();
	const query = new URLSearchParams({ site_id: NETLIFY_SITE_ID });
	const existingKeys = new Set((await listEnvVars()).map((variable) => variable.key));
	const created = Object.entries(values).filter(([key]) => !existingKeys.has(key));
	if (created.length > 0) {
		await netlifyRequest(`/accounts/${accountId}/env?${query}`, {
			method: "POST",
			body: JSON.stringify(
				created.map(([key, value]) => ({
					key,
					values: [{ context: "branch", context_parameter: branch, value }],
				})),
			),
		});
	}
	for (const [key, value] of Object.entries(values).filter(([key]) => existingKeys.has(key))) {
		await netlifyRequest(`/accounts/${accountId}/env/${encodeURIComponent(key)}?${query}`, {
			method: "PATCH",
			body: JSON.stringify({ context: "branch", context_parameter: branch, value }),
		});
	}
}

// Removes the branch's values, including keys an earlier `up` set that the
// current one no longer does.
async function deleteBranchValues(branch: string, keepKeys: string[] = []): Promise<void> {
	const accountId = await requireNetlifyAccountId();
	const query = new URLSearchParams({ site_id: NETLIFY_SITE_ID });
	for (const variable of await listEnvVars()) {
		if (keepKeys.includes(variable.key)) continue;
		for (const value of variable.values.filter((candidate) => isBranchValue(candidate, branch))) {
			if (!value.id) continue;
			await netlifyRequest(
				`/accounts/${accountId}/env/${encodeURIComponent(variable.key)}/value/${value.id}?${query}`,
				{ method: "DELETE" },
			);
		}
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

// The title identifies the deploy the build hook starts, which it does not
// report itself.
async function triggerNetlifyBuild(branch: string): Promise<string> {
	const hookUrl = requireBuildHookUrl();
	const title = `pnpm preview:up for ${branch} at ${new Date().toISOString()}`;
	const query = new URLSearchParams({ trigger_branch: branch, trigger_title: title });
	const response = await fetch(`${hookUrl}?${query}`, {
		method: "POST",
		body: "{}",
		signal: AbortSignal.timeout(NETLIFY_CALL_TIMEOUT_MS),
	});
	if (!response.ok) {
		throw new Error(`Netlify build hook ${response.status}: ${await response.text()}`);
	}
	return title;
}

async function findTriggeredDeploy(branch: string, title: string): Promise<NetlifyDeploy> {
	const deadline = Date.now() + DEPLOY_APPEAR_TIMEOUT_MS;
	while (Date.now() < deadline) {
		const deploys = await netlifyRequest<NetlifyDeploy[]>(
			`/sites/${NETLIFY_SITE_ID}/deploys?per_page=20`,
		);
		const deploy = deploys.find(
			(candidate) => candidate.branch === branch && candidate.title === title,
		);
		if (deploy) return deploy;
		await sleep(DEPLOY_POLL_INTERVAL_MS);
	}
	throw new Error(`Netlify did not start a deploy for "${title}"`);
}

// Waits until the new deploy serves the preview, so that `up` only finishes
// once the preview runs with the values it just wrote.
async function waitForPreviewDeploy(branch: string, title: string): Promise<void> {
	let deploy = await findTriggeredDeploy(branch, title);
	const deadline = Date.now() + DEPLOY_TIMEOUT_MS;
	let lastState = "";
	while (Date.now() < deadline) {
		if (deploy.state !== lastState) {
			console.log(`Netlify deploy ${deploy.id}: ${deploy.state}`);
			lastState = deploy.state;
		}
		// `netlify.toml` skips branch deploys that do not match PREVIEW_BRANCH. A
		// skipped deploy can still report the state "ready", but it publishes
		// nothing, so the skip has to be checked first.
		if (deploy.skipped || deploy.state === "error" || deploy.state === "rejected") {
			throw new Error(
				`Netlify deploy ${deploy.id} did not go live (${deploy.state}): ${deploy.error_message ?? "skipped"}`,
			);
		}
		if (deploy.state === "ready") return;
		await sleep(DEPLOY_POLL_INTERVAL_MS);
		deploy = await netlifyRequest<NetlifyDeploy>(`/deploys/${deploy.id}`);
	}
	throw new Error(`Timed out waiting for Netlify deploy ${deploy.id}`);
}

async function up(): Promise<void> {
	const branch = git("rev-parse", "--abbrev-ref", "HEAD");
	validateBranchName(branch);
	// Check everything that can be checked before any resource is created.
	requireEnvironments(UP_ENVIRONMENT);
	requireBuildHookUrl();
	await requireNetlifyAccountId();
	requirePushedBranch(branch);
	const sharedValues = readSharedPreviewValues();
	const name = `preview/${branch}`;
	const origin = `https://${branch}--${NETLIFY_SITE_NAME}.netlify.app`;

	console.log(`Provisioning Neon and ElevenLabs branches for "${branch}"`);
	const [databaseUrl, elevenLabsBranchId] = await Promise.all([
		provisionNeonBranch(name),
		provisionElevenLabsBranch(branch),
	]);

	const generatedValues: GeneratedPreviewValues = {
		PREVIEW_BRANCH: branch,
		DATABASE_URL: databaseUrl,
		ELEVENLABS_AGENT_BRANCH_ID: elevenLabsBranchId,
		ORIGIN: origin,
	};
	const values = { ...sharedValues, ...generatedValues };
	console.log(`Writing ${Object.keys(values).length} values to Netlify for branch "${branch}"`);
	await writeBranchValues(branch, values);
	await deleteBranchValues(branch, Object.keys(values));

	console.log("Triggering Netlify build");
	const title = await triggerNetlifyBuild(branch);
	await waitForPreviewDeploy(branch, title);
	console.log(`Preview live at ${origin}`);
}

async function down(): Promise<void> {
	const branch = process.argv[3] ?? git("rev-parse", "--abbrev-ref", "HEAD");
	validateBranchName(branch);
	requireEnvironments(DOWN_ENVIRONMENT);

	// Delete the values first so that no later build can use a database that is
	// about to be deleted: without PREVIEW_BRANCH, `netlify.toml` skips it.
	console.log(`Deleting Netlify values for branch "${branch}"`);
	await deleteBranchValues(branch);

	console.log(`Deleting Neon branch and archiving ElevenLabs branches for "${branch}"`);
	await Promise.all([deleteNeonBranch(`preview/${branch}`), archiveElevenLabsBranches(branch)]);
	console.log(
		`Done. The last deploy at https://${branch}--${NETLIFY_SITE_NAME}.netlify.app stays reachable until you delete it in Netlify, but its database is gone.`,
	);
}

async function main() {
	const action = process.argv[2];
	if (action === "up") return up();
	if (action === "down") return down();
	throw new Error('Expected action "up" or "down"');
}

try {
	await main();
} catch (error) {
	const message = error instanceof Error ? error.message : "Unknown error";
	console.error(message);
	process.exitCode = 1;
}
