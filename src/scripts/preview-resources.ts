import { ElevenLabsClient, ElevenLabsError } from "@elevenlabs/elevenlabs-js";
import { selectLatestCommittedVersionId } from "../lib/server/elevenlabs/branch.ts";

const NEON_API_BASE = "https://console.neon.tech/api/v2";
const NETLIFY_API_BASE = "https://api.netlify.com/api/v1";

type NetlifyDeploy = {
	id: string;
	branch: string | null;
};

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

// Only a confirmed 404 counts as "missing"; any other failure must abort the run
// so provisioning never forks a duplicate branch and cleanup never reports a
// false success.
async function getElevenLabsBranchIfExists<T>(request: Promise<T>): Promise<T | undefined> {
	try {
		return await request;
	} catch (error) {
		if (error instanceof ElevenLabsError && error.statusCode === 404) return undefined;
		throw error;
	}
}

function requireEnvironment(name: string): string {
	const value = process.env[name];
	if (!value) throw new Error(`${name} is not set`);
	return value;
}

function parsePullRequestNumber(value: string | undefined): number {
	const pullRequestNumber = Number(value);
	if (!Number.isSafeInteger(pullRequestNumber) || pullRequestNumber <= 0) {
		throw new Error("Expected a positive pull request number");
	}
	return pullRequestNumber;
}

// The deploy job's PR comment doubles as durable state for the ElevenLabs
// branch ID, so storage lives and dies with the pull request.
const PREVIEW_COMMENT_MARKER = "<!-- dialogbank-preview-deployment -->";
const PREVIEW_COMMENT_AUTHOR = "github-actions[bot]";
const ELEVENLABS_BRANCH_ID_PATTERN = /<!-- dialogbank-preview-elevenlabs-branch-id: (\S+) -->/;

type GitHubComment = {
	id: number;
	body?: string;
	user: { login: string } | null;
};

function elevenLabsBranchIdLine(branchId: string): string {
	return `<!-- dialogbank-preview-elevenlabs-branch-id: ${branchId} -->`;
}

async function githubRequest<T>(path: string, init?: RequestInit): Promise<T> {
	const apiUrl = process.env.GITHUB_API_URL ?? "https://api.github.com";
	const response = await fetch(`${apiUrl}${path}`, {
		...init,
		headers: {
			Accept: "application/vnd.github+json",
			Authorization: `Bearer ${requireEnvironment("GH_TOKEN")}`,
			"X-GitHub-Api-Version": "2022-11-28",
			...(init?.body ? { "Content-Type": "application/json" } : {}),
			...init?.headers,
		},
	});

	if (!response.ok) {
		throw new Error(`GitHub API ${response.status}: ${await response.text()}`);
	}

	return (await response.json()) as T;
}

async function findPreviewComment(pullRequestNumber: number): Promise<GitHubComment | undefined> {
	const repository = requireEnvironment("GITHUB_REPOSITORY");
	for (let page = 1; ; page++) {
		const comments = await githubRequest<GitHubComment[]>(
			`/repos/${repository}/issues/${pullRequestNumber}/comments?per_page=100&page=${page}`,
		);
		const comment = comments.find(
			(candidate) =>
				candidate.user?.login === PREVIEW_COMMENT_AUTHOR &&
				candidate.body?.includes(PREVIEW_COMMENT_MARKER),
		);
		if (comment) return comment;
		if (comments.length < 100) return undefined;
	}
}

async function readStoredElevenLabsBranchId(
	pullRequestNumber: number,
): Promise<string | undefined> {
	const comment = await findPreviewComment(pullRequestNumber);
	return comment?.body?.match(ELEVENLABS_BRANCH_ID_PATTERN)?.[1];
}

async function upsertPreviewComment(
	pullRequestNumber: number,
	update: { branchId?: string; status?: string; onlyIfExists?: boolean },
): Promise<void> {
	const repository = requireEnvironment("GITHUB_REPOSITORY");
	const comment = await findPreviewComment(pullRequestNumber);
	if (!comment && update.onlyIfExists) return;
	const previousBody = comment?.body ?? "";
	const branchId = update.branchId ?? previousBody.match(ELEVENLABS_BRANCH_ID_PATTERN)?.[1];
	const previousStatus = previousBody
		.split("\n")
		.filter((line) => line !== PREVIEW_COMMENT_MARKER && !ELEVENLABS_BRANCH_ID_PATTERN.test(line))
		.join("\n");
	const body = [
		PREVIEW_COMMENT_MARKER,
		...(branchId ? [elevenLabsBranchIdLine(branchId)] : []),
		update.status ?? (previousStatus || "Preview deployment in progress."),
	].join("\n");

	if (comment) {
		await githubRequest(`/repos/${repository}/issues/comments/${comment.id}`, {
			method: "PATCH",
			body: JSON.stringify({ body }),
		});
		return;
	}

	await githubRequest(`/repos/${repository}/issues/${pullRequestNumber}/comments`, {
		method: "POST",
		body: JSON.stringify({ body }),
	});
}

async function storeElevenLabsBranchId(pullRequestNumber: number, branchId: string): Promise<void> {
	await upsertPreviewComment(pullRequestNumber, { branchId });
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

async function provisionNeonBranch(name: string) {
	const projectId = requireEnvironment("NEON_PROJECT_ID");
	const parentId = requireEnvironment("PARENT_BRANCH_ID");
	// DATABASE_URL points at neon_local in CI, so its database and role do not
	// exist on the Neon project. Read them from the parent branch instead.
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
	// are not guaranteed to match DATABASE_URL's database and role.
	const query = new URLSearchParams({
		branch_id: branch.id,
		database_name: databaseName,
		role_name: roleName,
		pooled: "true",
	});
	const { uri } = await neonRequest<NeonConnectionUriResponse>(
		`/projects/${projectId}/connection_uri?${query}`,
	);

	return { id: branch.id, connectionUri: uri };
}

async function provisionElevenLabsBranch(name: string, pullRequestNumber: number): Promise<string> {
	const agentId = requireEnvironment("ELEVENLABS_AGENT_ID");
	const parentBranchId = requireEnvironment("ELEVENLABS_AGENT_PARENT_BRANCH_ID");
	const client = new ElevenLabsClient({ apiKey: requireEnvironment("ELEVENLABS_API_KEY") });

	const storedBranchId = await readStoredElevenLabsBranchId(pullRequestNumber);
	if (storedBranchId) {
		const branch = await getElevenLabsBranchIfExists(
			client.conversationalAi.agents.branches.get(agentId, storedBranchId),
		);
		if (branch) {
			if (branch.isArchived) {
				await client.conversationalAi.agents.branches.update(agentId, storedBranchId, {
					isArchived: false,
				});
			}
			return storedBranchId;
		}
	}

	// The branches.list endpoint has no pagination or name filter, so this bounded
	// search only reliably finds branches created before ID persistence was added.
	const branches = await client.conversationalAi.agents.branches.list(agentId, {
		includeArchived: true,
		limit: 100,
	});
	const existing = branches.results.find((branch) => branch.name === name);

	if (existing) {
		if (existing.isArchived) {
			await client.conversationalAi.agents.branches.update(agentId, existing.id, {
				isArchived: false,
			});
		}
		await storeElevenLabsBranchId(pullRequestNumber, existing.id);
		return existing.id;
	}

	const parentBranch = await client.conversationalAi.agents.branches.get(agentId, parentBranchId);
	const parentVersionId = selectLatestCommittedVersionId(parentBranch);

	const created = await client.conversationalAi.agents.branches.create(agentId, {
		parentVersionId,
		name,
		description: `Preview environment for ${name}`,
	});
	try {
		await storeElevenLabsBranchId(pullRequestNumber, created.createdBranchId);
	} catch (error) {
		// Without a persisted ID the branch is only discoverable through the bounded
		// name search, so archive it rather than leave an untracked active branch.
		await client.conversationalAi.agents.branches
			.update(agentId, created.createdBranchId, { isArchived: true })
			.catch((archiveError: unknown) => {
				console.error(
					`Failed to archive untracked ElevenLabs branch ${created.createdBranchId}:`,
					archiveError,
				);
			});
		throw error;
	}
	return created.createdBranchId;
}

async function netlifyRequest<T>(path: string, init?: RequestInit): Promise<T | undefined> {
	const response = await fetch(`${NETLIFY_API_BASE}${path}`, {
		...init,
		headers: {
			Accept: "application/json",
			Authorization: `Bearer ${requireEnvironment("NETLIFY_AUTH_TOKEN")}`,
			...init?.headers,
		},
	});

	if (!response.ok) {
		throw new Error(`Netlify API ${response.status}: ${await response.text()}`);
	}

	if (response.status === 204) return undefined;
	return (await response.json()) as T;
}

// `netlify deploy --alias` records the alias as the deploy's branch. Every
// deploy for the alias must go, otherwise the alias URL falls back to an older
// one that still points at the deleted database.
async function cleanupNetlifyDeploys(alias: string): Promise<void> {
	const siteId = requireEnvironment("NETLIFY_SITE_ID");
	const deployIds: string[] = [];
	for (let page = 1; ; page++) {
		const query = new URLSearchParams({ branch: alias, per_page: "100", page: String(page) });
		const deploys =
			(await netlifyRequest<NetlifyDeploy[]>(`/sites/${siteId}/deploys?${query}`)) ?? [];
		deployIds.push(...deploys.filter((deploy) => deploy.branch === alias).map(({ id }) => id));
		if (deploys.length < 100) break;
	}

	for (const deployId of deployIds) {
		await netlifyRequest(`/sites/${siteId}/deploys/${deployId}`, { method: "DELETE" });
	}
}

async function cleanupNeonBranch(name: string): Promise<void> {
	const projectId = requireEnvironment("NEON_PROJECT_ID");
	const branch = await findNeonBranch(projectId, name);
	if (!branch) return;
	await neonRequest(`/projects/${projectId}/branches/${branch.id}`, { method: "DELETE" });
}

async function cleanupElevenLabsBranch(name: string, pullRequestNumber: number): Promise<void> {
	const agentId = requireEnvironment("ELEVENLABS_AGENT_ID");
	const client = new ElevenLabsClient({ apiKey: requireEnvironment("ELEVENLABS_API_KEY") });

	const storedBranchId = await readStoredElevenLabsBranchId(pullRequestNumber);
	if (storedBranchId) {
		const branch = await getElevenLabsBranchIfExists(
			client.conversationalAi.agents.branches.get(agentId, storedBranchId),
		);
		if (branch && !branch.isArchived) {
			await client.conversationalAi.agents.branches.update(agentId, storedBranchId, {
				isArchived: true,
			});
		}
		return;
	}

	// The branches.list endpoint has no pagination or name filter, so this bounded
	// search only reliably finds branches created before ID persistence was added.
	const branches = await client.conversationalAi.agents.branches.list(agentId, {
		includeArchived: true,
		limit: 100,
	});
	const branch = branches.results.find((candidate) => candidate.name === name);
	if (!branch || branch.isArchived) return;
	await client.conversationalAi.agents.branches.update(agentId, branch.id, {
		isArchived: true,
	});
}

async function main() {
	const action = process.argv[2];
	const pullRequestNumber = parsePullRequestNumber(process.argv[3]);
	const name = `preview/pr-${pullRequestNumber}`;

	if (action === "provision") {
		const [neon, elevenLabsBranchId] = await Promise.all([
			provisionNeonBranch(name),
			provisionElevenLabsBranch(name, pullRequestNumber),
		]);
		process.stdout.write(
			JSON.stringify({
				name,
				neonBranchId: neon.id,
				databaseUrl: neon.connectionUri,
				elevenLabsBranchId,
			}),
		);
		return;
	}

	if (action === "cleanup") {
		// Retire the Netlify deploys first: if that fails, the database and agent
		// branch stay intact rather than being served by a stale alias.
		await cleanupNetlifyDeploys(`pr-${pullRequestNumber}`);
		await Promise.all([cleanupNeonBranch(name), cleanupElevenLabsBranch(name, pullRequestNumber)]);
		await upsertPreviewComment(pullRequestNumber, {
			status: "Preview removed.",
			onlyIfExists: true,
		});
		process.stdout.write(JSON.stringify({ name }));
		return;
	}

	throw new Error('Expected action "provision" or "cleanup"');
}

try {
	await main();
} catch (error) {
	const message = error instanceof Error ? error.message : "Unknown error";
	console.error(message);
	process.exitCode = 1;
}
