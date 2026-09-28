import { ElevenLabsClient, ElevenLabsError } from "@elevenlabs/elevenlabs-js";
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
			platformSettings?: {
				dataCollection?: Record<string, AnalysisProperty>;
				workspaceOverrides?: PostCallWebhookOverride;
			};
			workflow?: AgentWorkflowRequestModel;
		},
	) => Promise<void>;
};

// `null` removes the branch's override, leaving it without a post-call webhook
// as long as the workspace sets none by default.
type PostCallWebhookOverride = { webhooks: { postCallWebhookId: string | null } };

export type AgentBranchSummary = { id: string; name: string; isArchived: boolean };

export type AgentBranchVersion = { id: string; seqNoInBranch: number; timeCommittedSecs: number };

export type AgentBranchReader = {
	getMainBranchId: (agentId: string) => Promise<string | undefined>;
	list: (agentId: string) => Promise<AgentBranchSummary[]>;
	get: (
		agentId: string,
		branchId: string,
	) => Promise<{ mostRecentVersions?: AgentBranchVersion[] }>;
	create: (
		agentId: string,
		request: { parentVersionId: string; name: string; description: string },
	) => Promise<{ createdBranchId: string }>;
	getPostCallWebhookId: (agentId: string, branchId: string) => Promise<string | null>;
	setPostCallWebhook: (
		agentId: string,
		branchId: string,
		postCallWebhookId: string | null,
	) => Promise<void>;
	archive: (agentId: string, branchId: string) => Promise<void>;
};

export type ElevenLabsAgentTarget = {
	agentId: string;
	branchId?: string;
	workflowNodeId: string;
	postCallWebhookId: string | null;
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
	ELEVENLABS_POST_CALL_WEBHOOK_ID?: string;
	ELEVENLABS_WORKFLOW_NODE_ID?: string;
};

// Refers to each agent's main branch, whatever it is called: ElevenLabs names
// it "Main" on some agents.
const MAIN_BRANCH_NAME = "main";
const BRANCH_LIST_LIMIT = 100;

export function resolveElevenLabsAgentBranchName(environment: ElevenLabsEnv): string {
	const branchName = environment.ELEVENLABS_AGENT_BRANCH_NAME?.trim();
	if (!branchName) {
		throw error(500, "ELEVENLABS_AGENT_BRANCH_NAME is not configured on the server.");
	}
	return branchName;
}

const NO_POST_CALL_WEBHOOK = "none";

// Every branch Dialogbank uses gets this environment's post-call webhook. A new
// branch starts as a copy of the main branch, so it would otherwise send its
// conversations to production.
export function resolveElevenLabsPostCallWebhookId(environment: ElevenLabsEnv): string | null {
	const webhookId = environment.ELEVENLABS_POST_CALL_WEBHOOK_ID?.trim();
	if (!webhookId) {
		throw error(500, "ELEVENLABS_POST_CALL_WEBHOOK_ID is not configured on the server.");
	}
	return webhookId === NO_POST_CALL_WEBHOOK ? null : webhookId;
}

export async function resolveElevenLabsAgentTarget(
	environment: ElevenLabsEnv,
	branchReader?: AgentBranchReader,
): Promise<ElevenLabsAgentTarget> {
	const agentId = environment.ELEVENLABS_AGENT_ID;
	if (!agentId) {
		throw error(500, "ELEVENLABS_AGENT_ID is not configured on the server.");
	}
	return resolveElevenLabsAgentTargetForAgentId(environment, agentId, branchReader);
}

export async function resolveElevenLabsAgentTargetForAgentId(
	environment: ElevenLabsEnv,
	agentId: string,
	branchReader?: AgentBranchReader,
): Promise<ElevenLabsAgentTarget> {
	// All configuration is checked before a branch may be created.
	const branchName = resolveElevenLabsAgentBranchName(environment);
	const postCallWebhookId = resolveElevenLabsPostCallWebhookId(environment);
	const workflowNodeId = environment.ELEVENLABS_WORKFLOW_NODE_ID;
	if (!workflowNodeId) {
		throw error(500, "ELEVENLABS_WORKFLOW_NODE_ID is not configured on the server.");
	}

	const reader = branchReader ?? createElevenLabsAgentBranchReader(environment);
	const branchId =
		branchName === MAIN_BRANCH_NAME
			? await requireMainBranchId(agentId, reader)
			: await findOrCreateElevenLabsBranch(agentId, branchName, postCallWebhookId, reader);

	return { agentId, branchId, workflowNodeId, postCallWebhookId };
}

export function createElevenLabsAgentBranchReader(environment: ElevenLabsEnv): AgentBranchReader {
	const apiKey = environment.ELEVENLABS_API_KEY;
	if (!apiKey) {
		throw error(500, "ELEVENLABS_API_KEY is not configured on the server.");
	}

	const client = new ElevenLabsClient({ apiKey });
	return {
		getMainBranchId: async (agentId) =>
			(await client.conversationalAi.agents.get(agentId)).mainBranchId,
		list: async (agentId) => {
			const response = await client.conversationalAi.agents.branches.list(agentId, {
				includeArchived: false,
				limit: BRANCH_LIST_LIMIT,
			});
			return response.results;
		},
		get: async (agentId, branchId) =>
			client.conversationalAi.agents.branches.get(agentId, branchId),
		create: async (agentId, request) =>
			client.conversationalAi.agents.branches.create(agentId, request),
		archive: async (agentId, branchId) => {
			await client.conversationalAi.agents.branches.update(agentId, branchId, { isArchived: true });
		},
		getPostCallWebhookId: async (agentId, branchId) => {
			const agent = await client.conversationalAi.agents.get(agentId, { branchId });
			return agent.platformSettings?.workspaceOverrides?.webhooks?.postCallWebhookId ?? null;
		},
		setPostCallWebhook: async (agentId, branchId, postCallWebhookId) => {
			await updateAgent(client, agentId, {
				branchId,
				platformSettings: { workspaceOverrides: postCallWebhookOverride(postCallWebhookId) },
			});
		},
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

// A branch that already exists may still carry the webhook it inherited from the
// main branch, such as one created before this check, by E2E or by hand. It is
// read on every resolve and only written when it differs.
async function ensurePostCallWebhook(
	agentId: string,
	branchId: string,
	postCallWebhookId: string | null,
	reader: AgentBranchReader,
): Promise<void> {
	if ((await reader.getPostCallWebhookId(agentId, branchId)) !== postCallWebhookId) {
		await reader.setPostCallWebhook(agentId, branchId, postCallWebhookId);
	}
}

async function requireMainBranchId(agentId: string, reader: AgentBranchReader): Promise<string> {
	const mainBranchId = await reader.getMainBranchId(agentId);
	if (!mainBranchId) {
		throw error(500, `ElevenLabs agent ${agentId} has no main branch.`);
	}
	return mainBranchId;
}

async function findOrCreateElevenLabsBranch(
	agentId: string,
	branchName: string,
	postCallWebhookId: string | null,
	reader: AgentBranchReader,
): Promise<string> {
	const branches = await reader.list(agentId);
	const existing = branches.find((branch) => !branch.isArchived && branch.name === branchName);
	if (existing) {
		await ensurePostCallWebhook(agentId, existing.id, postCallWebhookId, reader);
		return existing.id;
	}
	// ElevenLabs cannot page past one response, so a full one may just not show
	// the branch, and creating it would fail on the name every time.
	if (branches.length >= BRANCH_LIST_LIMIT) {
		throw error(
			500,
			`ElevenLabs agent ${agentId} has ${BRANCH_LIST_LIMIT}+ active branches; archive unused ones first.`,
		);
	}

	const mainBranchDetails = await reader.get(agentId, await requireMainBranchId(agentId, reader));
	const parentVersionId = selectLatestCommittedVersionId(
		mainBranchDetails,
		agentId,
		MAIN_BRANCH_NAME,
	);

	let createdBranchId: string;
	try {
		const created = await reader.create(agentId, {
			parentVersionId,
			name: branchName,
			description: `Branch "${branchName}", created automatically by Dialogbank.`,
		});
		createdBranchId = created.createdBranchId;
	} catch (cause) {
		if (!isBranchNameConflict(cause)) throw cause;
		// ElevenLabs keeps active branch names unique, so a concurrent request
		// created the branch in the meantime.
		const concurrent = (await reader.list(agentId)).find(
			(branch) => !branch.isArchived && branch.name === branchName,
		);
		if (!concurrent) throw cause;
		return concurrent.id;
	}

	// A new branch starts on the main branch's webhook, so until this succeeds its
	// calls would reach production. ElevenLabs cannot create a branch with its own
	// webhook, so a branch that could not be switched over is archived again.
	try {
		await reader.setPostCallWebhook(agentId, createdBranchId, postCallWebhookId);
	} catch (cause) {
		let archived = true;
		try {
			await reader.archive(agentId, createdBranchId);
		} catch {
			archived = false;
		}
		throw error(
			500,
			`ElevenLabs branch "${branchName}" of agent ${agentId} could not be pointed at this environment's post-call webhook (${cause instanceof Error ? cause.message : "unknown error"}) and ${archived ? "was archived again" : "could not be archived; archive it by hand"}.`,
		);
	}
	return createdBranchId;
}

const branchNameConflictSchema = z.object({ detail: z.object({ code: z.literal("conflict") }) });

function isBranchNameConflict(cause: unknown): boolean {
	return (
		cause instanceof ElevenLabsError &&
		cause.statusCode === 400 &&
		branchNameConflictSchema.safeParse(cause.body).success
	);
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

function postCallWebhookOverride(postCallWebhookId: string | null): PostCallWebhookOverride {
	return { webhooks: { postCallWebhookId } };
}

// The SDK types `postCallWebhookId` as an optional string, but only `null`
// removes an override (verified against the API).
function updateAgent(
	client: ElevenLabsClient,
	agentId: string,
	request: Parameters<AgentWriter["update"]>[1],
) {
	return client.conversationalAi.agents.update(
		agentId,
		request as Parameters<ElevenLabsClient["conversationalAi"]["agents"]["update"]>[1],
	);
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
			await updateAgent(client, agentId, request);
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
	options?: { promptSupplement?: string | null },
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
	};

	await writer.update(target.agentId, {
		branchId: target.branchId,
		workflow: updatedWorkflow,
		platformSettings: {
			dataCollection: newDataCollection,
			workspaceOverrides: postCallWebhookOverride(target.postCallWebhookId),
		},
	});
}
