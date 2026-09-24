import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { selectLatestCommittedVersionId } from "../lib/server/elevenlabs/branch.ts";

const NEON_API_BASE = "https://console.neon.tech/api/v2";
const INFISICAL_API_BASE = "https://app.infisical.com/api";
const NETLIFY_BUILD_HOOK_PREFIX = "https://api.netlify.com/build_hooks/";
const NETLIFY_SITE_NAME = "dialogbank";

// The folder whose Netlify sync feeds the `branch-deploy` context. It holds the
// values of one preview at a time; `netlify.toml` refuses to build any other branch.
const INFISICAL_ENVIRONMENT = "prod";
const INFISICAL_PREVIEW_PATH = "/preview";
const PREVIEW_KEYS = [
	"PREVIEW_BRANCH",
	"DATABASE_URL",
	"ELEVENLABS_AGENT_BRANCH_ID",
	"ORIGIN",
] as const;

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
	const remote = git("ls-remote", "--heads", "origin", branch).split(/\s+/)[0];
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
// previews stay few. Tearing a preview down archives its branch, and setting it
// up again forks a fresh one.
async function findActiveElevenLabsBranch(client: ElevenLabsClient, agentId: string, name: string) {
	const limit = 100;
	const { results } = await client.conversationalAi.agents.branches.list(agentId, {
		includeArchived: false,
		limit,
	});
	if (results.length >= limit) {
		throw new Error(`Agent ${agentId} has ${limit}+ active branches; archive unused ones first`);
	}
	return results.find((branch) => branch.name === name);
}

async function provisionElevenLabsBranch(name: string): Promise<string> {
	const agentId = requireEnvironment("ELEVENLABS_AGENT_ID");
	const parentBranchId = requireEnvironment("ELEVENLABS_AGENT_PARENT_BRANCH_ID");
	const client = new ElevenLabsClient({ apiKey: requireEnvironment("ELEVENLABS_API_KEY") });

	const existing = await findActiveElevenLabsBranch(client, agentId, name);
	if (existing) return existing.id;

	const parentBranch = await client.conversationalAi.agents.branches.get(agentId, parentBranchId);
	const created = await client.conversationalAi.agents.branches.create(agentId, {
		parentVersionId: selectLatestCommittedVersionId(parentBranch),
		name,
		description: `Preview environment for ${name}`,
	});
	return created.createdBranchId;
}

async function archiveElevenLabsBranch(name: string): Promise<void> {
	const agentId = requireEnvironment("ELEVENLABS_AGENT_ID");
	const client = new ElevenLabsClient({ apiKey: requireEnvironment("ELEVENLABS_API_KEY") });

	const branch = await findActiveElevenLabsBranch(client, agentId, name);
	if (!branch) return;
	await client.conversationalAi.agents.branches.update(agentId, branch.id, { isArchived: true });
}

let infisicalToken: string | undefined;

async function infisicalRequest<T>(path: string, init?: RequestInit): Promise<T> {
	// The signed-in user's own session; no machine identity is needed.
	infisicalToken ??= infisical("user", "get", "token", "--plain");
	const token = infisicalToken;
	const response = await fetch(`${INFISICAL_API_BASE}${path}`, {
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
	const { workspaceId } = JSON.parse(readFileSync(".infisical.json", "utf8")) as {
		workspaceId: string;
	};
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
async function syncPreviewSecrets(): Promise<void> {
	const { id, lastSyncedAt: previousSyncedAt } = await findPreviewSync();
	await infisicalRequest(`/v1/secret-syncs/netlify/${id}/sync-secrets`, { method: "POST" });

	const deadline = Date.now() + SYNC_TIMEOUT_MS;
	let started = false;
	while (Date.now() < deadline) {
		const { secretSync } = await infisicalRequest<{ secretSync: InfisicalSecretSync }>(
			`/v1/secret-syncs/netlify/${id}`,
		);
		if (secretSync.syncStatus === "pending" || secretSync.syncStatus === "running") {
			started = true;
		} else if (
			secretSync.syncStatus === "succeeded" &&
			secretSync.lastSyncedAt !== previousSyncedAt
		) {
			return;
		} else if (secretSync.syncStatus === "failed" && started) {
			throw new Error(`Infisical sync to Netlify failed: ${secretSync.lastSyncMessage}`);
		}
		await new Promise((resolve) => setTimeout(resolve, SYNC_POLL_INTERVAL_MS));
	}
	throw new Error("Timed out waiting for the Infisical sync to Netlify");
}

function readPreviewBranch(): string | undefined {
	let value: string;
	try {
		value = infisical(
			"secrets",
			"get",
			"PREVIEW_BRANCH",
			"--env",
			INFISICAL_ENVIRONMENT,
			"--path",
			INFISICAL_PREVIEW_PATH,
			"--plain",
		);
	} catch {
		return undefined;
	}
	// The CLI prints a placeholder instead of failing when the secret is missing.
	return /^[a-z0-9-]+$/.test(value) ? value : undefined;
}

// Secrets go through a private temporary file instead of command-line arguments,
// which other local processes could read.
function writePreviewSecrets(values: Record<(typeof PREVIEW_KEYS)[number], string>): void {
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

function deletePreviewSecrets(): void {
	infisical(
		"secrets",
		"delete",
		...PREVIEW_KEYS,
		"--env",
		INFISICAL_ENVIRONMENT,
		"--path",
		INFISICAL_PREVIEW_PATH,
	);
}

async function triggerNetlifyBuild(branch: string): Promise<void> {
	const hookUrl = requireEnvironment("NETLIFY_BUILD_HOOK_URL");
	if (!hookUrl.startsWith(NETLIFY_BUILD_HOOK_PREFIX)) {
		throw new Error(`NETLIFY_BUILD_HOOK_URL must start with ${NETLIFY_BUILD_HOOK_PREFIX}`);
	}
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
	requirePushedBranch(branch);
	const name = `preview/${branch}`;
	const origin = `https://${branch}--${NETLIFY_SITE_NAME}.netlify.app`;

	console.log(`Provisioning Neon and ElevenLabs branches "${name}"`);
	const [databaseUrl, elevenLabsBranchId] = await Promise.all([
		provisionNeonBranch(name),
		provisionElevenLabsBranch(name),
	]);

	const previousBranch = readPreviewBranch();
	if (previousBranch && previousBranch !== branch) {
		console.log(
			`Taking over Infisical ${INFISICAL_PREVIEW_PATH} from "${previousBranch}"; its existing deploy keeps working, but it will not rebuild`,
		);
	}
	console.log(
		`Writing preview values to Infisical ${INFISICAL_ENVIRONMENT} ${INFISICAL_PREVIEW_PATH}`,
	);
	writePreviewSecrets({
		PREVIEW_BRANCH: branch,
		DATABASE_URL: databaseUrl,
		ELEVENLABS_AGENT_BRANCH_ID: elevenLabsBranchId,
		ORIGIN: origin,
	});

	console.log("Syncing Infisical to Netlify");
	await syncPreviewSecrets();

	console.log("Triggering Netlify build");
	await triggerNetlifyBuild(branch);
	console.log(`Preview building at ${origin}`);
}

async function down(): Promise<void> {
	const branch = process.argv[3] ?? git("rev-parse", "--abbrev-ref", "HEAD");
	validateBranchName(branch);
	const name = `preview/${branch}`;

	// Unset the values first so that no later push can build against a
	// database that is about to be deleted.
	if (readPreviewBranch() === branch) {
		console.log(`Removing preview values from Infisical ${INFISICAL_PREVIEW_PATH}`);
		deletePreviewSecrets();
		await syncPreviewSecrets();
	}

	console.log(`Deleting Neon branch and archiving ElevenLabs branch "${name}"`);
	await Promise.all([deleteNeonBranch(name), archiveElevenLabsBranch(name)]);
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
