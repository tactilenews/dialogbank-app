import { spawnSync } from "node:child_process";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { selectLatestCommittedVersionId } from "../lib/server/elevenlabs/branch.ts";

const NEON_API_BASE = "https://console.neon.tech/api/v2";
const GITHUB_REPOSITORY = "tactilenews/dialogbank-app";

type NeonBranch = {
	id: string;
	name: string;
};

type NeonBranchesResponse = {
	branches: NeonBranch[];
};

type NeonCreateBranchResponse = {
	branch: NeonBranch;
	connection_uris?: Array<{ connection_uri: string }>;
};

type NeonConnectionUriResponse = {
	uri: string;
};

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

function elevenLabsBranchIdVariableName(pullRequestNumber: number): string {
	return `PREVIEW_PR_${pullRequestNumber}_ELEVENLABS_BRANCH_ID`;
}

function readRepoVariable(name: string): string | undefined {
	const result = spawnSync(
		"gh",
		["variable", "get", name, "--repo", GITHUB_REPOSITORY, "--json", "value", "-q", ".value"],
		{ encoding: "utf8" },
	);
	if (result.status !== 0) return undefined;
	const value = result.stdout.trim();
	return value.length > 0 ? value : undefined;
}

function writeRepoVariable(name: string, value: string): void {
	const result = spawnSync(
		"gh",
		["variable", "set", name, "--body", value, "--repo", GITHUB_REPOSITORY],
		{ encoding: "utf8" },
	);
	if (result.status !== 0) {
		throw new Error(result.stderr.trim() || `Failed to set repo variable ${name}`);
	}
}

function deleteRepoVariable(name: string): void {
	const result = spawnSync("gh", ["variable", "delete", name, "--repo", GITHUB_REPOSITORY], {
		encoding: "utf8",
	});
	if (result.status !== 0 && !/not found/i.test(result.stderr)) {
		throw new Error(result.stderr.trim() || `Failed to delete repo variable ${name}`);
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
	const response = await neonRequest<NeonBranchesResponse>(`/projects/${projectId}/branches`);
	return response.branches.find((branch) => branch.name === name);
}

async function provisionNeonBranch(name: string) {
	const projectId = requireEnvironment("NEON_PROJECT_ID");
	const parentId = requireEnvironment("PARENT_BRANCH_ID");
	const parentDatabaseUrl = new URL(requireEnvironment("DATABASE_URL"));
	const databaseName = decodeURIComponent(parentDatabaseUrl.pathname.replace(/^\//, ""));
	const roleName = decodeURIComponent(parentDatabaseUrl.username);
	if (!databaseName || !roleName) {
		throw new Error("DATABASE_URL must contain a database name and role");
	}
	let branch = await findNeonBranch(projectId, name);
	let connectionUri: string | undefined;

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
		connectionUri = response.connection_uris?.[0]?.connection_uri;
	}

	if (!connectionUri) {
		const query = new URLSearchParams({
			branch_id: branch.id,
			database_name: databaseName,
			role_name: roleName,
			pooled: "true",
		});
		const response = await neonRequest<NeonConnectionUriResponse>(
			`/projects/${projectId}/connection_uri?${query}`,
		);
		connectionUri = response.uri;
	}

	return { id: branch.id, connectionUri };
}

async function provisionElevenLabsBranch(name: string, pullRequestNumber: number): Promise<string> {
	const agentId = requireEnvironment("ELEVENLABS_AGENT_ID");
	const parentBranchId = requireEnvironment("ELEVENLABS_AGENT_PARENT_BRANCH_ID");
	const client = new ElevenLabsClient({ apiKey: requireEnvironment("ELEVENLABS_API_KEY") });
	const variableName = elevenLabsBranchIdVariableName(pullRequestNumber);

	const storedBranchId = readRepoVariable(variableName);
	if (storedBranchId) {
		const branch = await client.conversationalAi.agents.branches
			.get(agentId, storedBranchId)
			.catch(() => undefined);
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
		writeRepoVariable(variableName, existing.id);
		return existing.id;
	}

	const parentBranch = await client.conversationalAi.agents.branches.get(agentId, parentBranchId);
	const parentVersionId = selectLatestCommittedVersionId(parentBranch);

	const created = await client.conversationalAi.agents.branches.create(agentId, {
		parentVersionId,
		name,
		description: `Preview environment for ${name}`,
	});
	writeRepoVariable(variableName, created.createdBranchId);
	return created.createdBranchId;
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
	const variableName = elevenLabsBranchIdVariableName(pullRequestNumber);

	const storedBranchId = readRepoVariable(variableName);
	if (storedBranchId) {
		const branch = await client.conversationalAi.agents.branches
			.get(agentId, storedBranchId)
			.catch(() => undefined);
		if (branch && !branch.isArchived) {
			await client.conversationalAi.agents.branches.update(agentId, storedBranchId, {
				isArchived: true,
			});
		}
		deleteRepoVariable(variableName);
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
		await Promise.all([cleanupNeonBranch(name), cleanupElevenLabsBranch(name, pullRequestNumber)]);
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
