import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import type { GetAgentResponseModel } from "@elevenlabs/elevenlabs-js/api";

export const ELEVENLABS_SNAPSHOT_PATH = "e2e/.elevenlabs-snapshot.json";

export type AgentSnapshot = Pick<GetAgentResponseModel, "workflow" | "platformSettings">;

type ElevenLabsBranchMethods = Pick<
	ElevenLabsClient["conversationalAi"]["agents"]["branches"],
	"get" | "create" | "update"
>;

type ElevenLabsBranchClient = {
	conversationalAi: {
		agents: {
			branches: ElevenLabsBranchMethods;
			get: (agentId: string, request?: { branchId?: string }) => Promise<AgentSnapshot>;
			update: (agentId: string, request: { branchId?: string } & AgentSnapshot) => Promise<void>;
		};
	};
};

export type ElevenLabsBranchEnvironment = {
	ELEVENLABS_API_KEY?: string;
	ELEVENLABS_AGENT_ID?: string;
	ELEVENLABS_AGENT_PARENT_BRANCH_ID?: string;
};

export type ElevenLabsBranchContext = {
	apiKey: string;
	agentId: string;
	parentBranchId: string;
};

export function resolveElevenLabsBranchContext(
	environment: ElevenLabsBranchEnvironment,
): ElevenLabsBranchContext {
	const apiKey = environment.ELEVENLABS_API_KEY;
	if (!apiKey) {
		throw new Error("ELEVENLABS_API_KEY is not set");
	}

	const agentId = environment.ELEVENLABS_AGENT_ID;
	if (!agentId) {
		throw new Error("ELEVENLABS_AGENT_ID is not set");
	}

	const parentBranchId = environment.ELEVENLABS_AGENT_PARENT_BRANCH_ID;
	if (!parentBranchId) {
		throw new Error("ELEVENLABS_AGENT_PARENT_BRANCH_ID is not set");
	}

	return {
		apiKey,
		agentId,
		parentBranchId,
	};
}

export function createElevenLabsBranchClient(apiKey: string): ElevenLabsBranchClient {
	const client = new ElevenLabsClient({ apiKey });

	return {
		conversationalAi: {
			agents: {
				branches: {
					get: async (agentId, branchId) =>
						client.conversationalAi.agents.branches.get(agentId, branchId),
					create: async (agentId, request) =>
						client.conversationalAi.agents.branches.create(agentId, request),
					update: async (agentId, branchId, request) =>
						client.conversationalAi.agents.branches.update(agentId, branchId, request),
				},
				get: async (agentId, request): Promise<AgentSnapshot> => {
					const response = await client.conversationalAi.agents.get(agentId, request);
					return {
						workflow: response.workflow,
						platformSettings: response.platformSettings,
					};
				},
				update: async (agentId, request): Promise<void> => {
					await (
						client.conversationalAi.agents.update as unknown as (
							id: string,
							req: unknown,
						) => Promise<void>
					)(agentId, request);
				},
			},
		},
	};
}

export async function fetchAgentSnapshot(
	client: ElevenLabsBranchClient,
	agentId: string,
	branchId: string,
): Promise<AgentSnapshot> {
	return client.conversationalAi.agents.get(agentId, { branchId });
}

export async function restoreAgentSnapshot(
	client: ElevenLabsBranchClient,
	agentId: string,
	branchId: string,
	snapshot: AgentSnapshot,
): Promise<void> {
	await client.conversationalAi.agents.update(agentId, { branchId, ...snapshot });
}

export function createEphemeralBranchName(now: Date) {
	const timestamp = now.toISOString().replace(/[:.]/g, "-");
	const randomSuffix = Math.random().toString(36).slice(2, 8);
	return `dialogbank-e2e-${timestamp}-${randomSuffix}`;
}

export function selectLatestCommittedVersionId(branch: {
	mostRecentVersions?: Array<{
		id: string;
		seqNoInBranch: number;
		timeCommittedSecs: number;
	}>;
}) {
	const latestVersion = [...(branch.mostRecentVersions ?? [])].sort((left, right) => {
		if (left.seqNoInBranch !== right.seqNoInBranch) {
			return right.seqNoInBranch - left.seqNoInBranch;
		}

		return right.timeCommittedSecs - left.timeCommittedSecs;
	})[0];

	if (!latestVersion) {
		throw new Error("The configured ElevenLabs branch has no committed versions to branch from");
	}

	return latestVersion.id;
}

export async function createEphemeralElevenLabsBranch(
	client: ElevenLabsBranchClient,
	context: ElevenLabsBranchContext,
	now = new Date(),
) {
	const parentBranch = await client.conversationalAi.agents.branches.get(
		context.agentId,
		context.parentBranchId,
	);
	const parentVersionId = selectLatestCommittedVersionId(parentBranch);
	const name = createEphemeralBranchName(now);
	const createdBranch = await client.conversationalAi.agents.branches.create(context.agentId, {
		parentVersionId,
		name,
		description: `Ephemeral Dialogbank E2E branch created at ${now.toISOString()}`,
	});

	return createdBranch.createdBranchId;
}

export async function deleteElevenLabsBranch(
	client: ElevenLabsBranchClient,
	context: Pick<ElevenLabsBranchContext, "agentId">,
	branchId: string,
) {
	await client.conversationalAi.agents.branches.update(context.agentId, branchId, {
		isArchived: true,
	});
}
