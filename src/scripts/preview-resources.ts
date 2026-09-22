import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const NEON_API_BASE = "https://console.neon.tech/api/v2";

type NeonBranch = {
	id: string;
	name: string;
};

type NeonBranchesResponse = {
	branches: NeonBranch[];
};

type NeonCreateBranchResponse = {
	branch: NeonBranch;
	connectionUris?: Array<{ connectionUri: string }>;
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
		connectionUri =
			response.connectionUris?.[0]?.connectionUri ?? response.connection_uris?.[0]?.connection_uri;
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

async function provisionElevenLabsBranch(name: string): Promise<string> {
	const agentId = requireEnvironment("ELEVENLABS_AGENT_ID");
	const parentBranchId = requireEnvironment("ELEVENLABS_AGENT_PARENT_BRANCH_ID");
	const client = new ElevenLabsClient({ apiKey: requireEnvironment("ELEVENLABS_API_KEY") });
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
		return existing.id;
	}

	const parentBranch = await client.conversationalAi.agents.branches.get(agentId, parentBranchId);
	const parentVersion = [...(parentBranch.mostRecentVersions ?? [])].sort(
		(left, right) => right.seqNoInBranch - left.seqNoInBranch,
	)[0];
	if (!parentVersion) throw new Error("The ElevenLabs parent branch has no committed version");

	const created = await client.conversationalAi.agents.branches.create(agentId, {
		parentVersionId: parentVersion.id,
		name,
		description: `Preview environment for ${name}`,
	});
	return created.createdBranchId;
}

async function cleanupNeonBranch(name: string): Promise<void> {
	const projectId = requireEnvironment("NEON_PROJECT_ID");
	const branch = await findNeonBranch(projectId, name);
	if (!branch) return;
	await neonRequest(`/projects/${projectId}/branches/${branch.id}`, { method: "DELETE" });
}

async function cleanupElevenLabsBranch(name: string): Promise<void> {
	const agentId = requireEnvironment("ELEVENLABS_AGENT_ID");
	const client = new ElevenLabsClient({ apiKey: requireEnvironment("ELEVENLABS_API_KEY") });
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
			provisionElevenLabsBranch(name),
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
		await Promise.all([cleanupNeonBranch(name), cleanupElevenLabsBranch(name)]);
		process.stdout.write(JSON.stringify({ name }));
		return;
	}

	throw new Error('Expected action "provision" or "cleanup"');
}

await main();
