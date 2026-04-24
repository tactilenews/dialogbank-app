import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import type {
	AgentWorkflowRequestModel,
	GetAgentResponseModel,
	LiteralJsonSchemaProperty,
} from "@elevenlabs/elevenlabs-js/api";
import { error } from "@sveltejs/kit";
import { slugify } from "$lib/slugify";

const QUESTION_KEY_PREFIX = "question_";
const CLASSIFICATION_KEY_PREFIX = "classification_";
const WORKFLOW_NODE_PROMPT_PREAMBLE = "Stelle der Person nacheinander diese Fragen:\n\n";

export type Question = {
	text: string;
	classifications: string[];
};

export type AgentReaderResponse = Pick<
	GetAgentResponseModel,
	"name" | "conversationConfig" | "platformSettings" | "workflow"
>;

type AgentReader = {
	get: (
		agentId: string,
		request?: {
			branchId?: string;
		},
	) => Promise<AgentReaderResponse>;
};

type AgentWriter = {
	update: (
		agentId: string,
		request: {
			branchId?: string;
			platformSettings?: { dataCollection?: Record<string, LiteralJsonSchemaProperty> };
			workflow?: AgentWorkflowRequestModel;
		},
	) => Promise<void>;
};

export type ElevenLabsAgentTarget = {
	agentId: string;
	branchId?: string;
	workflowNodeId: string;
};

export type ElevenLabsEditorAgent = {
	id: string;
	branchId?: string;
	nodeAdditionalPrompt: string;
	dataCollection: Record<string, LiteralJsonSchemaProperty>;
	questions: Question[];
};

export type ElevenLabsEnv = {
	ELEVENLABS_AGENT_ID?: string;
	ELEVENLABS_AGENT_BRANCH_ID?: string;
	ELEVENLABS_API_KEY?: string;
	ELEVENLABS_WORKFLOW_NODE_ID?: string;
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

	const workflowNodeId = environment.ELEVENLABS_WORKFLOW_NODE_ID;
	if (!workflowNodeId) {
		throw error(500, "ELEVENLABS_WORKFLOW_NODE_ID is not configured on the server.");
	}

	return { agentId, branchId, workflowNodeId };
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

export function createElevenLabsAgentWriter(environment: ElevenLabsEnv): AgentWriter {
	const apiKey = environment.ELEVENLABS_API_KEY;
	if (!apiKey) {
		throw error(500, "ELEVENLABS_API_KEY is not configured on the server.");
	}

	const client = new ElevenLabsClient({
		apiKey,
	});

	return {
		update: async (agentId, request) => {
			await client.conversationalAi.agents.update(agentId, request);
		},
	};
}

export function parseQuestionsFromWorkflowNodePrompt(additionalPrompt: string): string[] {
	if (!additionalPrompt.startsWith(WORKFLOW_NODE_PROMPT_PREAMBLE)) return [];
	const list = additionalPrompt.slice(WORKFLOW_NODE_PROMPT_PREAMBLE.length);
	return list
		.split("\n")
		.map((line) => line.match(/^\d+\.\s+(.+)$/)?.[1]?.trim() ?? "")
		.filter(Boolean);
}

export function buildWorkflowNodeAdditionalPrompt(questions: string[]): string {
	const list = questions.map((q, i) => `${i + 1}. ${q}`).join("\n");
	return `${WORKFLOW_NODE_PROMPT_PREAMBLE}${list}`;
}

function parseClassificationsFromDataCollection(
	dataCollection: Record<string, LiteralJsonSchemaProperty> | undefined,
	index: number,
): string[] {
	const description = dataCollection?.[`${CLASSIFICATION_KEY_PREFIX}${index}`]?.description;
	if (!description) return [];
	return description
		.split("\n")
		.map((line) => line.match(/^[a-z0-9-]+:\s+(.+)$/)?.[1]?.trim() ?? "")
		.filter(Boolean);
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
	agent: AgentReaderResponse,
): ElevenLabsEditorAgent {
	const workflowNode = agent.workflow?.nodes[target.workflowNodeId];
	const nodeAdditionalPrompt =
		workflowNode?.type === "override_agent" ? workflowNode.additionalPrompt : "";
	const questionTexts =
		workflowNode?.type === "override_agent"
			? parseQuestionsFromWorkflowNodePrompt(workflowNode.additionalPrompt)
			: [];

	const dataCollection = agent.platformSettings?.dataCollection ?? {};
	const questions: Question[] = questionTexts.map((text, i) => ({
		text,
		classifications: parseClassificationsFromDataCollection(dataCollection, i),
	}));

	return {
		id: target.agentId,
		branchId: target.branchId,
		nodeAdditionalPrompt,
		dataCollection,
		questions,
	};
}

export function parseQuestionsFromDataCollection(
	dataCollection: Record<string, LiteralJsonSchemaProperty> | undefined,
): string[] {
	if (!dataCollection) return [];

	return Object.entries(dataCollection)
		.filter(([key]) => key.startsWith(QUESTION_KEY_PREFIX))
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([, schema]) => {
			const desc = schema.description ?? "";
			const match = desc.match(/^Wie hat die Person auf die Frage "(.*)" geantwortet\?$/);
			return match ? match[1] : desc;
		})
		.filter(Boolean);
}

export function buildQuestionDataCollectionEntries(
	questions: Question[],
): Record<string, LiteralJsonSchemaProperty> {
	const entries: Record<string, LiteralJsonSchemaProperty> = {};
	for (let i = 0; i < questions.length; i++) {
		const { text, classifications } = questions[i];
		entries[`${QUESTION_KEY_PREFIX}${i}`] = {
			type: "string",
			description: `Wie hat die Person auf die Frage "${text}" geantwortet?`,
		};
		if (classifications.length > 0) {
			const lines = classifications.map((label) => `${slugify(label)}: ${label}`).join("\n");
			entries[`${CLASSIFICATION_KEY_PREFIX}${i}`] = {
				type: "string",
				description: `Wie kann die Antwort auf die Frage "${text}" klassifiziert werden:\n\n${lines}\n`,
				enum: classifications.map(slugify),
			};
		}
	}
	return entries;
}

export async function updateElevenLabsAgentQuestions(
	target: ElevenLabsAgentTarget,
	questions: Question[],
	existingAgent: AgentReaderResponse,
	writer: AgentWriter,
): Promise<void> {
	const existingWorkflow = existingAgent.workflow;
	const existingNode = existingWorkflow?.nodes[target.workflowNodeId];

	if (!existingWorkflow || existingNode?.type !== "override_agent") {
		throw error(
			500,
			`Workflow node "${target.workflowNodeId}" not found or is not an override_agent node.`,
		);
	}

	const updatedWorkflow: AgentWorkflowRequestModel = {
		...existingWorkflow,
		nodes: {
			...(existingWorkflow.nodes as AgentWorkflowRequestModel["nodes"]),
			[target.workflowNodeId]: {
				...existingNode,
				type: "override_agent" as const,
				additionalPrompt: buildWorkflowNodeAdditionalPrompt(questions.map((q) => q.text)),
			},
		},
		edges: existingWorkflow.edges as AgentWorkflowRequestModel["edges"],
	};

	const existingDataCollection = existingAgent.platformSettings?.dataCollection;
	const baseDataCollection = Object.fromEntries(
		Object.entries(existingDataCollection ?? {}).filter(
			([key]) => !key.startsWith(QUESTION_KEY_PREFIX) && !key.startsWith(CLASSIFICATION_KEY_PREFIX),
		),
	);
	const newDataCollection = {
		...baseDataCollection,
		...buildQuestionDataCollectionEntries(questions),
	};

	await writer.update(target.agentId, {
		branchId: target.branchId,
		workflow: updatedWorkflow,
		platformSettings: { dataCollection: newDataCollection },
	});
}
