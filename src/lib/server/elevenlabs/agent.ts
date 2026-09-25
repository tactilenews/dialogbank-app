import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import type {
	AgentWorkflowRequestModel,
	AnalysisProperty,
	GetAgentResponseModel,
} from "@elevenlabs/elevenlabs-js/api";
import { error } from "@sveltejs/kit";
import { z } from "zod";
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
			platformSettings?: { dataCollection?: Record<string, AnalysisProperty> };
			workflow?: AgentWorkflowRequestModel;
		},
	) => Promise<{ versionId?: string }>;
};

export type AgentBranchSummary = { id: string; name: string; isArchived: boolean };

export type AgentBranchVersion = { id: string; seqNoInBranch: number; timeCommittedSecs: number };

export type AgentBranchReader = {
	list: (agentId: string) => Promise<AgentBranchSummary[]>;
	get: (
		agentId: string,
		branchId: string,
	) => Promise<{ mostRecentVersions?: AgentBranchVersion[] }>;
	create: (
		agentId: string,
		request: { parentVersionId: string; name: string; description: string },
	) => Promise<{ createdBranchId: string }>;
};

export type AgentCatalogReader = {
	list: (request: { tag: string }) => Promise<ElevenLabsAgentCatalogEntry[]>;
};

export type ElevenLabsAgentTarget = {
	agentId: string;
	branchId?: string;
	workflowNodeId: string;
};

export type ElevenLabsAgentCatalogEntry = {
	id: string;
	name: string;
	voiceId: string | null;
	tags: string[];
	archived: boolean;
};

export type ElevenLabsEditorAgent = {
	id: string;
	branchId?: string;
	nodeAdditionalPrompt: string;
	dataCollection: Record<string, AnalysisProperty>;
	questions: Question[];
};

export type ElevenLabsEnv = {
	ELEVENLABS_AGENT_ID?: string;
	ELEVENLABS_AGENT_BRANCH_NAME?: string;
	ELEVENLABS_API_KEY?: string;
	ELEVENLABS_DIALOGBANK_AGENT_TAG?: string;
	ELEVENLABS_WORKFLOW_NODE_ID?: string;
};

const agentListResponseSchema = z.object({
	agents: z
		.array(
			z.object({
				agent_id: z.string(),
				name: z.string(),
				voice_id: z.string().nullable().optional(),
				tags: z.array(z.string()).nullable().optional(),
				archived: z.boolean().optional(),
			}),
		)
		.default([]),
	has_more: z.boolean().optional(),
	next_cursor: z.string().nullable().optional(),
});

export function resolveElevenLabsDialogbankAgentTag(environment: ElevenLabsEnv): string {
	return environment.ELEVENLABS_DIALOGBANK_AGENT_TAG?.trim() || "dialogbank";
}

export function isSelectableDialogbankAgent(
	agent: ElevenLabsAgentCatalogEntry,
	requiredTag: string,
): boolean {
	return !agent.archived && agent.tags.includes(requiredTag);
}

// `pnpm preview:init` and `pnpm preview:down` reset the preview's branch name to
// this placeholder instead of deleting it, see `src/scripts/preview.ts`.
const UNSET_BRANCH_NAME = "unset";
const MAIN_BRANCH_NAME = "main";

export function resolveElevenLabsAgentBranchName(environment: ElevenLabsEnv): string {
	const branchName = environment.ELEVENLABS_AGENT_BRANCH_NAME?.trim();
	if (!branchName || branchName === UNSET_BRANCH_NAME) {
		throw error(500, "ELEVENLABS_AGENT_BRANCH_NAME is not configured on the server.");
	}
	return branchName;
}

export async function resolveElevenLabsAgentTargetForAgentId(
	environment: ElevenLabsEnv,
	agentId: string,
	branchReader?: AgentBranchReader,
): Promise<ElevenLabsAgentTarget> {
	const branchName = resolveElevenLabsAgentBranchName(environment);
	const reader = branchReader ?? createElevenLabsAgentBranchReader(environment);
	const branches = await reader.list(agentId);
	let branchId = branches.find((branch) => !branch.isArchived && branch.name === branchName)?.id;
	if (!branchId) {
		if (branchName === MAIN_BRANCH_NAME) {
			throw error(500, `ElevenLabs branch "${branchName}" was not found for agent ${agentId}.`);
		}
		branchId = await createElevenLabsBranchFromMain(agentId, branchName, branches, reader);
	}

	const workflowNodeId = environment.ELEVENLABS_WORKFLOW_NODE_ID;
	if (!workflowNodeId) {
		throw error(500, "ELEVENLABS_WORKFLOW_NODE_ID is not configured on the server.");
	}

	return { agentId, branchId, workflowNodeId };
}

export function createElevenLabsAgentBranchReader(environment: ElevenLabsEnv): AgentBranchReader {
	const apiKey = environment.ELEVENLABS_API_KEY;
	if (!apiKey) {
		throw error(500, "ELEVENLABS_API_KEY is not configured on the server.");
	}

	const client = new ElevenLabsClient({ apiKey });
	return {
		list: async (agentId) => {
			const response = await client.conversationalAi.agents.branches.list(agentId, {
				includeArchived: false,
				limit: 100,
			});
			return response.results;
		},
		get: async (agentId, branchId) =>
			client.conversationalAi.agents.branches.get(agentId, branchId),
		create: async (agentId, request) =>
			client.conversationalAi.agents.branches.create(agentId, request),
	};
}

function selectLatestCommittedVersionId(
	branch: { mostRecentVersions?: AgentBranchVersion[] },
	agentId: string,
	branchName: string,
): string {
	const latestVersion = [...(branch.mostRecentVersions ?? [])].sort((left, right) => {
		if (left.seqNoInBranch !== right.seqNoInBranch) {
			return right.seqNoInBranch - left.seqNoInBranch;
		}
		return right.timeCommittedSecs - left.timeCommittedSecs;
	})[0];

	if (!latestVersion) {
		throw error(
			500,
			`ElevenLabs branch "${branchName}" for agent ${agentId} has no committed versions to branch from.`,
		);
	}

	return latestVersion.id;
}

async function createElevenLabsBranchFromMain(
	agentId: string,
	branchName: string,
	branches: AgentBranchSummary[],
	reader: AgentBranchReader,
): Promise<string> {
	const mainBranch = branches.find(
		(branch) => !branch.isArchived && branch.name === MAIN_BRANCH_NAME,
	);
	if (!mainBranch) {
		throw error(500, `ElevenLabs branch "${MAIN_BRANCH_NAME}" was not found for agent ${agentId}.`);
	}

	const mainBranchDetails = await reader.get(agentId, mainBranch.id);
	const parentVersionId = selectLatestCommittedVersionId(
		mainBranchDetails,
		agentId,
		MAIN_BRANCH_NAME,
	);

	const created = await reader.create(agentId, {
		parentVersionId,
		name: branchName,
		description: `Branch "${branchName}", created automatically by Dialogbank.`,
	});

	return created.createdBranchId;
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

export function createElevenLabsAgentCatalogReader(environment: ElevenLabsEnv): AgentCatalogReader {
	const apiKey = environment.ELEVENLABS_API_KEY;
	if (!apiKey) {
		throw error(500, "ELEVENLABS_API_KEY is not configured on the server.");
	}

	return {
		list: async ({ tag }) => {
			const agents: ElevenLabsAgentCatalogEntry[] = [];
			let cursor: string | undefined;

			do {
				const url = new URL("https://api.elevenlabs.io/v1/convai/agents");
				url.searchParams.append("tags", tag);
				if (cursor) url.searchParams.set("cursor", cursor);

				const response = await fetch(url, {
					headers: {
						"xi-api-key": apiKey,
					},
				});

				if (!response.ok) {
					throw error(response.status, `ElevenLabs agents could not be loaded.`);
				}

				const page = agentListResponseSchema.parse(await response.json());
				agents.push(
					...page.agents.map((agent) => ({
						id: agent.agent_id,
						name: agent.name,
						voiceId: agent.voice_id ?? null,
						tags: agent.tags ?? [],
						archived: agent.archived ?? false,
					})),
				);
				cursor = page.has_more ? (page.next_cursor ?? undefined) : undefined;
			} while (cursor);

			return agents.filter((agent) => !agent.archived);
		},
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
		update: async (agentId, request) => client.conversationalAi.agents.update(agentId, request),
	};
}

export async function listElevenLabsDialogbankAgents(
	environment: ElevenLabsEnv,
	reader = createElevenLabsAgentCatalogReader(environment),
): Promise<ElevenLabsAgentCatalogEntry[]> {
	const tag = resolveElevenLabsDialogbankAgentTag(environment);
	return reader.list({ tag });
}

export function parseQuestionsFromWorkflowNodePrompt(additionalPrompt: string): string[] {
	if (!additionalPrompt.startsWith(WORKFLOW_NODE_PROMPT_PREAMBLE)) return [];
	const list = additionalPrompt.slice(WORKFLOW_NODE_PROMPT_PREAMBLE.length);
	return list
		.split("\n")
		.map((line) => line.match(/^\d+\.\s+(.+)$/)?.[1]?.trim() ?? "")
		.filter(Boolean);
}

export function buildWorkflowNodeAdditionalPrompt(
	questions: string[],
	promptSupplement?: string | null,
): string {
	const list = questions.map((q, i) => `${i + 1}. ${q}`).join("\n");
	const base = `${WORKFLOW_NODE_PROMPT_PREAMBLE}${list}`;
	return promptSupplement ? `${base}\n\n${promptSupplement}` : base;
}

function parseClassificationsFromDataCollection(
	dataCollection: Record<string, AnalysisProperty> | undefined,
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
	dataCollection: Record<string, AnalysisProperty> | undefined,
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
): Record<string, AnalysisProperty> {
	const entries: Record<string, AnalysisProperty> = {};
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
	options?: { promptSupplement?: string | null; assignmentId?: number },
): Promise<string | null> {
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
				additionalPrompt: buildWorkflowNodeAdditionalPrompt(
					questions.map((q) => q.text),
					options?.promptSupplement,
				),
			},
		},
		edges: existingWorkflow.edges as AgentWorkflowRequestModel["edges"],
	};

	const existingDataCollection = existingAgent.platformSettings?.dataCollection;
	const baseDataCollection = Object.fromEntries(
		Object.entries(existingDataCollection ?? {}).filter(
			([key]) =>
				!key.startsWith(QUESTION_KEY_PREFIX) &&
				!key.startsWith(CLASSIFICATION_KEY_PREFIX) &&
				key !== "assignment_id",
		),
	);
	const newDataCollection = {
		...baseDataCollection,
		...buildQuestionDataCollectionEntries(questions),
		...(options?.assignmentId === undefined
			? {}
			: {
					assignment_id: {
						type: "string" as const,
						constantValue: String(options.assignmentId),
					},
				}),
	};

	const updatedAgent = await writer.update(target.agentId, {
		branchId: target.branchId,
		workflow: updatedWorkflow,
		platformSettings: { dataCollection: newDataCollection },
	});
	return updatedAgent.versionId ?? null;
}

export async function removeElevenLabsAgentAssignment(
	target: ElevenLabsAgentTarget,
	existingAgent: AgentReaderResponse,
	writer: AgentWriter,
): Promise<string | null> {
	const dataCollection = Object.fromEntries(
		Object.entries(existingAgent.platformSettings?.dataCollection ?? {}).filter(
			([key]) => key !== "assignment_id",
		),
	);

	const updatedAgent = await writer.update(target.agentId, {
		branchId: target.branchId,
		platformSettings: { dataCollection },
	});
	return updatedAgent.versionId ?? null;
}
