import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const NEON_API_BASE = "https://console.neon.tech/api/v2";
const INFISICAL_DEFAULT_DOMAIN = "https://app.infisical.com/api";
const NETLIFY_BUILD_HOOK_PREFIX = "https://api.netlify.com/build_hooks/";
const NETLIFY_SITE_NAME = "dialogbank";

// The folder whose Netlify sync feeds the `branch-deploy` context. It holds the
// values of one preview at a time; `netlify.toml` refuses to build any other branch.
const INFISICAL_ENVIRONMENT = "prod";
const INFISICAL_PREVIEW_PATH = "/preview";

// `/preview` imports the `prod` root folder, so deleting a key there would let
// production's value (such as its DATABASE_URL) reach branch deploys. Keys are
// therefore never deleted, only reset to values that cannot connect anywhere.
const UNSET = "unset";
const PREVIEW_PLACEHOLDERS = {
	PREVIEW_BRANCH: UNSET,
	DATABASE_URL: "postgres://unset:unset@preview-unset.invalid/unset",
	ELEVENLABS_AGENT_BRANCH_NAME: UNSET,
	ORIGIN: "https://preview-unset.invalid",
};
type PreviewValues = Record<keyof typeof PREVIEW_PLACEHOLDERS, string>;

const UP_ENVIRONMENT = [
	"NEON_API_KEY",
	"NEON_PROJECT_ID",
	"PARENT_BRANCH_ID",
	"ELEVENLABS_API_KEY",
	"NETLIFY_BUILD_HOOK_URL",
];
const DOWN_ENVIRONMENT = ["NEON_API_KEY", "NEON_PROJECT_ID", "ELEVENLABS_API_KEY"];

const SYNC_TIMEOUT_MS = 120_000;
const SYNC_POLL_INTERVAL_MS = 2_000;

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

type InfisicalSecretSync = {
	id: string;
	syncStatus: "pending" | "running" | "succeeded" | "failed" | null;
	lastSyncMessage: string | null;
	lastSyncedAt: string | null;
	folder: { path: string } | null;
	environment: { slug: string } | null;
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
	if (branch === "main" || branch === "HEAD" || branch === UNSET) {
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

// The app creates the ElevenLabs branch named ELEVENLABS_AGENT_BRANCH_NAME on
// each agent the first time a preview uses it, so every agent Dialogbank can
// select must be searched. ElevenLabs cannot filter branches by name or page
// past one response, so only active branches are searched: archived ones pile
// up over time, while active previews stay few. Names get a timestamp so that a
// new branch never reuses the name of an archived one.
function elevenLabsBranchPrefix(branch: string): string {
	return `preview/${branch}/`;
}

async function listDialogbankAgentIds(client: ElevenLabsClient): Promise<string[]> {
	const tag = process.env.ELEVENLABS_DIALOGBANK_AGENT_TAG?.trim() || "dialogbank";
	const agentIds: string[] = [];
	let cursor: string | undefined;
	do {
		const page = await client.conversationalAi.agents.list({ tags: tag, pageSize: 100, cursor });
		agentIds.push(...page.agents.map((agent) => agent.agentId));
		cursor = page.hasMore ? page.nextCursor : undefined;
	} while (cursor);
	return agentIds;
}

async function findActiveElevenLabsBranches(branch: string) {
	const client = new ElevenLabsClient({ apiKey: requireEnvironment("ELEVENLABS_API_KEY") });
	const limit = 100;
	const branchesPerAgent = await Promise.all(
		(await listDialogbankAgentIds(client)).map(async (agentId) => {
			const { results } = await client.conversationalAi.agents.branches.list(agentId, {
				includeArchived: false,
				limit,
			});
			if (results.length >= limit) {
				throw new Error(
					`Agent ${agentId} has ${limit}+ active branches; archive unused ones first`,
				);
			}
			return results
				.filter((candidate) => candidate.name.startsWith(elevenLabsBranchPrefix(branch)))
				.map((candidate) => ({ agentId, id: candidate.id, name: candidate.name }));
		}),
	);
	return { client, branches: branchesPerAgent.flat() };
}

// Reuse the name of an earlier `up` so that the preview keeps the agent
// configuration it was given.
async function resolveElevenLabsBranchName(branch: string): Promise<string> {
	const { branches } = await findActiveElevenLabsBranches(branch);
	const [latest] = branches
		.map((candidate) => candidate.name)
		.sort((left, right) => right.localeCompare(left));
	if (latest) return latest;
	const timestamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
	return `${elevenLabsBranchPrefix(branch)}${timestamp}`;
}

async function archiveElevenLabsBranches(branch: string): Promise<void> {
	const { client, branches } = await findActiveElevenLabsBranches(branch);
	for (const candidate of branches) {
		await client.conversationalAi.agents.branches.update(candidate.agentId, candidate.id, {
			isArchived: true,
		});
	}
}

// Use the same Infisical instance as the CLI, whose session token the API calls
// reuse; a token from one instance is rejected by any other.
function infisicalApiBase(): string {
	const domain =
		process.env.INFISICAL_DOMAIN ??
		readJson(".infisical.json")?.domain ??
		readJson(join(homedir(), ".infisical", "infisical-config.json"))?.LoggedInUserDomain ??
		INFISICAL_DEFAULT_DOMAIN;
	if (typeof domain !== "string") throw new Error("Could not determine the Infisical domain");
	const base = domain.replace(/\/+$/, "");
	return base.endsWith("/api") ? base : `${base}/api`;
}

let infisicalToken: string | undefined;

async function infisicalRequest<T>(path: string, init?: RequestInit): Promise<T> {
	// The signed-in user's own session; no machine identity is needed.
	infisicalToken ??= infisical("user", "get", "token", "--plain");
	const token = infisicalToken;
	const response = await fetch(`${infisicalApiBase()}${path}`, {
		...init,
		headers: {
			Accept: "application/json",
			Authorization: `Bearer ${token}`,
			...init?.headers,
		},
	});

	if (!response.ok) {
		throw new Error(`Infisical API ${response.status}: ${await response.text()}`);
	}

	return (await response.json()) as T;
}

async function findPreviewSync(): Promise<InfisicalSecretSync> {
	const workspaceId = readJson(".infisical.json")?.workspaceId;
	if (typeof workspaceId !== "string") throw new Error("No workspaceId in .infisical.json");
	const { secretSyncs } = await infisicalRequest<{ secretSyncs: InfisicalSecretSync[] }>(
		`/v1/secret-syncs/netlify?${new URLSearchParams({ projectId: workspaceId })}`,
	);
	const matches = secretSyncs.filter(
		(sync) =>
			sync.environment?.slug === INFISICAL_ENVIRONMENT &&
			sync.folder?.path === INFISICAL_PREVIEW_PATH,
	);
	const [sync] = matches;
	if (!sync || matches.length > 1) {
		throw new Error(
			`Expected exactly one Netlify sync for ${INFISICAL_ENVIRONMENT} ${INFISICAL_PREVIEW_PATH}, found ${matches.length}`,
		);
	}
	return sync;
}

// Netlify reads environment variables when a build starts, so the build may only
// be triggered once the new values have arrived there.
async function syncPreviewSecrets(syncId: string): Promise<void> {
	const path = `/v1/secret-syncs/netlify/${syncId}`;
	const { secretSync: before } = await infisicalRequest<{ secretSync: InfisicalSecretSync }>(path);
	// Queuing a sync resets its status to pending, so any failure seen afterwards
	// belongs to this run.
	await infisicalRequest(`${path}/sync-secrets`, { method: "POST" });

	const deadline = Date.now() + SYNC_TIMEOUT_MS;
	while (Date.now() < deadline) {
		const { secretSync } = await infisicalRequest<{ secretSync: InfisicalSecretSync }>(path);
		if (secretSync.syncStatus === "failed") {
			throw new Error(`Infisical sync to Netlify failed: ${secretSync.lastSyncMessage}`);
		}
		if (secretSync.syncStatus === "succeeded" && secretSync.lastSyncedAt !== before.lastSyncedAt) {
			return;
		}
		await new Promise((resolve) => setTimeout(resolve, SYNC_POLL_INTERVAL_MS));
	}
	throw new Error("Timed out waiting for the Infisical sync to Netlify");
}

// With --plain the CLI prints nothing for a missing secret. Any other failure,
// such as an expired session, must abort: `down` would otherwise delete the
// database while `/preview` still points at it.
function readPreviewSecret(key: string): string {
	return infisical(
		"secrets",
		"get",
		key,
		"--env",
		INFISICAL_ENVIRONMENT,
		"--path",
		INFISICAL_PREVIEW_PATH,
		"--plain",
	);
}

function readPreviewBranch(): string | undefined {
	const value = readPreviewSecret("PREVIEW_BRANCH");
	return value && value !== UNSET ? value : undefined;
}

// Secrets go through a private temporary file instead of command-line arguments,
// which other local processes could read.
function writePreviewSecrets(values: Partial<PreviewValues>): void {
	const directory = mkdtempSync(join(tmpdir(), "preview-"));
	const file = join(directory, "preview.env");
	try {
		const lines = Object.entries(values).map(([key, value]) => `${key}=${JSON.stringify(value)}`);
		writeFileSync(file, `${lines.join("\n")}\n`, { mode: 0o600 });
		infisical(
			"secrets",
			"set",
			"--file",
			file,
			"--env",
			INFISICAL_ENVIRONMENT,
			"--path",
			INFISICAL_PREVIEW_PATH,
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
}

function requireBuildHookUrl(): string {
	const hookUrl = requireEnvironment("NETLIFY_BUILD_HOOK_URL");
	if (!hookUrl.startsWith(NETLIFY_BUILD_HOOK_PREFIX)) {
		throw new Error(`NETLIFY_BUILD_HOOK_URL must start with ${NETLIFY_BUILD_HOOK_PREFIX}`);
	}
	return hookUrl;
}

async function triggerNetlifyBuild(branch: string): Promise<void> {
	const hookUrl = requireBuildHookUrl();
	const query = new URLSearchParams({
		trigger_branch: branch,
		trigger_title: `pnpm preview:up for ${branch}`,
	});
	const response = await fetch(`${hookUrl}?${query}`, { method: "POST", body: "{}" });
	if (!response.ok) {
		throw new Error(`Netlify build hook ${response.status}: ${await response.text()}`);
	}
}

async function up(): Promise<void> {
	const branch = git("rev-parse", "--abbrev-ref", "HEAD");
	validateBranchName(branch);
	// Check everything that can be checked before any resource is created or
	// `/preview` is taken over from another branch.
	requireEnvironments(UP_ENVIRONMENT);
	requireBuildHookUrl();
	requirePushedBranch(branch);
	const { id: syncId } = await findPreviewSync();
	const name = `preview/${branch}`;
	const origin = `https://${branch}--${NETLIFY_SITE_NAME}.netlify.app`;

	console.log(`Provisioning Neon and ElevenLabs branches for "${branch}"`);
	const [databaseUrl, elevenLabsBranchName] = await Promise.all([
		provisionNeonBranch(name),
		resolveElevenLabsBranchName(branch),
	]);

	const previousBranch = readPreviewBranch();
	if (previousBranch && previousBranch !== branch) {
		console.log(
			`Taking over Infisical ${INFISICAL_PREVIEW_PATH} from "${previousBranch}". Its last deploy keeps working but cannot be redeployed; run \`pnpm run preview:down ${previousBranch}\` once it is no longer needed.`,
		);
	}
	console.log(
		`Writing preview values to Infisical ${INFISICAL_ENVIRONMENT} ${INFISICAL_PREVIEW_PATH}`,
	);
	writePreviewSecrets({
		PREVIEW_BRANCH: branch,
		DATABASE_URL: databaseUrl,
		ELEVENLABS_AGENT_BRANCH_NAME: elevenLabsBranchName,
		ORIGIN: origin,
	});

	console.log("Syncing Infisical to Netlify");
	await syncPreviewSecrets(syncId);

	console.log("Triggering Netlify build");
	await triggerNetlifyBuild(branch);
	console.log(`Preview building at ${origin}`);
}

async function down(): Promise<void> {
	const branch = process.argv[3] ?? git("rev-parse", "--abbrev-ref", "HEAD");
	validateBranchName(branch);
	requireEnvironments(DOWN_ENVIRONMENT);
	const { id: syncId } = await findPreviewSync();

	// Reset the values first so that no later build can use a database that is
	// about to be deleted.
	if (readPreviewBranch() === branch) {
		console.log(`Resetting preview values in Infisical ${INFISICAL_PREVIEW_PATH}`);
		writePreviewSecrets(PREVIEW_PLACEHOLDERS);
		await syncPreviewSecrets(syncId);
	}

	console.log(`Deleting Neon branch and archiving ElevenLabs branches for "${branch}"`);
	await Promise.all([deleteNeonBranch(`preview/${branch}`), archiveElevenLabsBranches(branch)]);
	console.log(
		`Done. The last deploy at https://${branch}--${NETLIFY_SITE_NAME}.netlify.app stays reachable until you delete it in Netlify, but its database is gone.`,
	);
}

// Runs before the `/preview` sync is created, and again whenever a key is added
// to the placeholders: that sync starts by copying the folder to Netlify, and
// without these values the folder would hand branch deploys the production
// values it imports. Keys that already exist are left alone.
function init(): void {
	const missing = Object.fromEntries(
		Object.entries(PREVIEW_PLACEHOLDERS).filter(([key]) => readPreviewSecret(key) === ""),
	);
	if (Object.keys(missing).length === 0) {
		console.log(`Infisical ${INFISICAL_PREVIEW_PATH} is already initialized`);
		return;
	}
	writePreviewSecrets(missing);
	console.log(
		`Wrote placeholders for ${Object.keys(missing).join(", ")} to Infisical ${INFISICAL_ENVIRONMENT} ${INFISICAL_PREVIEW_PATH}`,
	);
}

async function main() {
	const action = process.argv[2];
	if (action === "init") return init();
	if (action === "up") return up();
	if (action === "down") return down();
	throw new Error('Expected action "init", "up" or "down"');
}

try {
	await main();
} catch (error) {
	const message = error instanceof Error ? error.message : "Unknown error";
	console.error(message);
	process.exitCode = 1;
}
