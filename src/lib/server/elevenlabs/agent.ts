import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import type { GetAgentResponseModel } from "@elevenlabs/elevenlabs-js/api";
import { error } from "@sveltejs/kit";

type AgentReader = {
	get: (
		agentId: string,
		request?: {
			branchId?: string;
		},
	) => Promise<Pick<GetAgentResponseModel, "name" | "conversationConfig">>;
};

export type ElevenLabsAgentTarget = {
	agentId: string;
	branchId?: string;
};

export type ElevenLabsEditorAgent = {
	id: string;
	branchId?: string;
	name: string;
	systemPrompt: string;
};

export type ElevenLabsEnv = {
	ELEVENLABS_AGENT_ID?: string;
	ELEVENLABS_AGENT_BRANCH_ID?: string;
	ELEVENLABS_API_KEY?: string;
};

export function resolveElevenLabsAgentTarget(environment: ElevenLabsEnv): ElevenLabsAgentTarget {
	const agentId = environment.ELEVENLABS_AGENT_ID;
	if (!agentId) {
		throw error(500, "ELEVENLABS_AGENT_ID is not configured on the server.");
	}

	const branchId = environment.ELEVENLABS_AGENT_BRANCH_ID;
	if (!branchId) {
		throw error(500, "ELEVENLABS_AGENT_BRANCH_ID is not configured on the server.");
	}

	return { agentId, branchId };
}

export function createElevenLabsAgentReader(environment: ElevenLabsEnv): AgentReader {
	const apiKey = environment.ELEVENLABS_API_KEY;
	if (!apiKey) {
		throw error(500, "ELEVENLABS_API_KEY is not configured on the server.");
	}

	const client = new ElevenLabsClient({
		apiKey,
	});

	return {
		get: async (agentId, request) => client.conversationalAi.agents.get(agentId, request),
	};
}

export async function getElevenLabsEditorAgent(
	target: ElevenLabsAgentTarget,
	reader: AgentReader,
): Promise<ElevenLabsEditorAgent> {
	const agent = await reader.get(target.agentId, {
		branchId: target.branchId,
	});

	return mapElevenLabsEditorAgent(target, agent);
}

function mapElevenLabsEditorAgent(
	target: ElevenLabsAgentTarget,
	agent: Pick<GetAgentResponseModel, "name" | "conversationConfig">,
): ElevenLabsEditorAgent {
	return {
		id: target.agentId,
		branchId: target.branchId,
		name: agent.name ?? "Unnamed Agent",
		systemPrompt: agent.conversationConfig?.agent?.prompt?.prompt ?? "No system prompt configured.",
	};
}
