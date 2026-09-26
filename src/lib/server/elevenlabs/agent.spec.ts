import { ElevenLabsError } from "@elevenlabs/elevenlabs-js";
import type {
	AgentWorkflowResponseModel,
	AnalysisProperty,
	GetAgentResponseModel,
} from "@elevenlabs/elevenlabs-js/api";
import { describe, expect, it, vi } from "vitest";
import { slugify } from "$lib/slugify";
import {
	type AgentReaderResponse,
	buildQuestionDataCollectionEntries,
	buildWorkflowNodeAdditionalPrompt,
	type ElevenLabsAgentCatalogEntry,
	getElevenLabsEditorAgent,
	isSelectableDialogbankAgent,
	listElevenLabsDialogbankAgents,
	parseQuestionsFromDataCollection,
	parseQuestionsFromWorkflowNodePrompt,
	type Question,
	resolveElevenLabsAgentBranchName,
	resolveElevenLabsAgentTargetForAgentId,
	resolveElevenLabsDialogbankAgentTag,
	resolveElevenLabsPostCallWebhookId,
	updateElevenLabsAgentQuestions,
} from "./agent";

const WORKFLOW_NODE_ID = "node_e2e_12345";

const agentTarget = {
	agentId: "agent_main_123",
	branchId: "agtbrch_e2e_123",
	workflowNodeId: WORKFLOW_NODE_ID,
	postCallWebhookId: "wh_env",
};

describe("isSelectableDialogbankAgent", () => {
	it("accepts only active agents carrying the required tag", () => {
		const agent = {
			id: "agent_dialogbank",
			name: "Nadia",
			voiceId: null,
			tags: ["dialogbank"],
			archived: false,
		};

		expect(isSelectableDialogbankAgent(agent, "dialogbank")).toBe(true);
		expect(isSelectableDialogbankAgent({ ...agent, tags: ["other"] }, "dialogbank")).toBe(false);
		expect(isSelectableDialogbankAgent({ ...agent, archived: true }, "dialogbank")).toBe(false);
	});
});

function makeOverrideAgentNode(additionalPrompt: string) {
	return {
		type: "override_agent" as const,
		label: "Fragen",
		additionalPrompt,
		conversationConfig: {},
		additionalKnowledgeBase: [],
		additionalToolIds: [],
		position: { x: 0, y: 0 },
		edgeOrder: [],
		entryBehavior: "auto" as const,
	};
}

function makeWorkflow(additionalPrompt: string): AgentWorkflowResponseModel {
	return {
		preventSubagentLoops: false,
		edges: {},
		nodes: {
			[WORKFLOW_NODE_ID]: makeOverrideAgentNode(additionalPrompt),
		},
	};
}

function makeQuestion(text: string, classifications: string[] = []): Question {
	return { text, classifications };
}

describe("slugify", () => {
	it("lowercases and replaces spaces with hyphens", () => {
		expect(slugify("Option A")).toBe("option-a");
		expect(slugify("Problem mit Gelsenkirchen")).toBe("problem-mit-gelsenkirchen");
	});

	it("converts German umlauts", () => {
		expect(slugify("Idee für Gelsenkirchen")).toBe("idee-fuer-gelsenkirchen");
		expect(slugify("Gute Sache über Gelsenkirchen")).toBe("gute-sache-ueber-gelsenkirchen");
		expect(slugify("Köln")).toBe("koeln");
		expect(slugify("Straße")).toBe("strasse");
	});

	it("trims leading and trailing hyphens", () => {
		expect(slugify("  hello world  ")).toBe("hello-world");
	});

	it("collapses consecutive non-alphanumeric characters into a single hyphen", () => {
		expect(slugify("hello   world")).toBe("hello-world");
		expect(slugify("a & b")).toBe("a-b");
	});
});

describe("resolveElevenLabsAgentBranchName", () => {
	it("returns the configured branch name", () => {
		expect(resolveElevenLabsAgentBranchName({ ELEVENLABS_AGENT_BRANCH_NAME: " main " })).toBe(
			"main",
		);
	});

	it.each([
		["missing", undefined],
		["empty", ""],
		["the preview placeholder", "unset"],
	])("rejects a branch name that is %s", (_, branchName) => {
		expect(() =>
			resolveElevenLabsAgentBranchName({ ELEVENLABS_AGENT_BRANCH_NAME: branchName }),
		).toThrow(
			expect.objectContaining({
				status: 500,
				body: { message: "ELEVENLABS_AGENT_BRANCH_NAME is not configured on the server." },
			}),
		);
	});
});

describe("resolveElevenLabsPostCallWebhookId", () => {
	it("returns the configured webhook id", () => {
		expect(resolveElevenLabsPostCallWebhookId({ ELEVENLABS_POST_CALL_WEBHOOK_ID: " wh_1 " })).toBe(
			"wh_1",
		);
	});

	it("turns none into no webhook", () => {
		expect(
			resolveElevenLabsPostCallWebhookId({ ELEVENLABS_POST_CALL_WEBHOOK_ID: "none" }),
		).toBeNull();
	});

	it.each([
		["missing", undefined],
		["the preview placeholder", "unset"],
	])("rejects a webhook id that is %s", (_, webhookId) => {
		expect(() =>
			resolveElevenLabsPostCallWebhookId({ ELEVENLABS_POST_CALL_WEBHOOK_ID: webhookId }),
		).toThrow(
			expect.objectContaining({
				status: 500,
				body: { message: "ELEVENLABS_POST_CALL_WEBHOOK_ID is not configured on the server." },
			}),
		);
	});
});

describe("resolveElevenLabsAgentTargetForAgentId", () => {
	function createBranchReader(
		overrides: Partial<{
			mainBranchId: string | undefined;
			branches: { id: string; name: string; isArchived: boolean }[];
			mostRecentVersions: { id: string; seqNoInBranch: number; timeCommittedSecs: number }[];
		}> = {},
	) {
		// An explicit `mainBranchId: undefined` stands for an agent without a main branch.
		const mainBranchId = "mainBranchId" in overrides ? overrides.mainBranchId : "agtbrch_main_123";
		const {
			branches = [{ id: "agtbrch_main_123", name: "Main", isArchived: false }],
			mostRecentVersions = [
				{ id: "version_older", seqNoInBranch: 1, timeCommittedSecs: 100 },
				{ id: "version_latest", seqNoInBranch: 2, timeCommittedSecs: 200 },
			],
		} = overrides;
		return {
			getMainBranchId: vi.fn().mockResolvedValue(mainBranchId),
			setPostCallWebhook: vi.fn().mockResolvedValue(undefined),
			list: vi.fn().mockResolvedValue(branches),
			get: vi.fn().mockResolvedValue({ mostRecentVersions }),
			create: vi.fn().mockResolvedValue({
				createdBranchId: "agtbrch_created",
				createdVersionId: "version_new",
			}),
		};
	}

	it("resolves main to the agent's main branch, whatever it is called", async () => {
		const branchReader = createBranchReader();

		await expect(
			resolveElevenLabsAgentTargetForAgentId(
				{
					ELEVENLABS_AGENT_BRANCH_NAME: "main",
					ELEVENLABS_POST_CALL_WEBHOOK_ID: "wh_env",
					ELEVENLABS_WORKFLOW_NODE_ID: WORKFLOW_NODE_ID,
				},
				"agent_main_123",
				branchReader,
			),
		).resolves.toEqual({
			agentId: "agent_main_123",
			branchId: "agtbrch_main_123",
			workflowNodeId: WORKFLOW_NODE_ID,
			postCallWebhookId: "wh_env",
		});
		expect(branchReader.getMainBranchId).toHaveBeenCalledWith("agent_main_123");
		expect(branchReader.create).not.toHaveBeenCalled();
	});

	it("rejects without creating anything when the agent has no main branch", async () => {
		const branchReader = createBranchReader({ mainBranchId: undefined });

		await expect(
			resolveElevenLabsAgentTargetForAgentId(
				{
					ELEVENLABS_AGENT_BRANCH_NAME: "main",
					ELEVENLABS_POST_CALL_WEBHOOK_ID: "wh_env",
					ELEVENLABS_WORKFLOW_NODE_ID: WORKFLOW_NODE_ID,
				},
				"agent_main_123",
				branchReader,
			),
		).rejects.toMatchObject({
			status: 500,
			body: { message: "ElevenLabs agent agent_main_123 has no main branch." },
		});
		expect(branchReader.create).not.toHaveBeenCalled();
	});

	it("resolves the configured branch name on any agent", async () => {
		const branchReader = createBranchReader({
			branches: [
				{ id: "agtbrch_main_123", name: "Main", isArchived: false },
				{ id: "agtbrch_preview_123", name: "preview/feature", isArchived: false },
			],
		});

		await expect(
			resolveElevenLabsAgentTargetForAgentId(
				{
					ELEVENLABS_AGENT_ID: "agent_default",
					ELEVENLABS_AGENT_BRANCH_NAME: "preview/feature",
					ELEVENLABS_POST_CALL_WEBHOOK_ID: "wh_env",
					ELEVENLABS_WORKFLOW_NODE_ID: WORKFLOW_NODE_ID,
				},
				"agent_other",
				branchReader,
			),
		).resolves.toEqual({
			agentId: "agent_other",
			branchId: "agtbrch_preview_123",
			workflowNodeId: WORKFLOW_NODE_ID,
			postCallWebhookId: "wh_env",
		});
		expect(branchReader.create).not.toHaveBeenCalled();
	});

	it("ignores archived branches with the configured name", async () => {
		const branchReader = createBranchReader({
			branches: [
				{ id: "agtbrch_archived", name: "development", isArchived: true },
				{ id: "agtbrch_dev_123", name: "development", isArchived: false },
			],
		});

		await expect(
			resolveElevenLabsAgentTargetForAgentId(
				{
					ELEVENLABS_AGENT_BRANCH_NAME: "development",
					ELEVENLABS_POST_CALL_WEBHOOK_ID: "wh_env",
					ELEVENLABS_WORKFLOW_NODE_ID: WORKFLOW_NODE_ID,
				},
				"agent_main_123",
				branchReader,
			),
		).resolves.toMatchObject({ branchId: "agtbrch_dev_123" });
	});

	it("creates a missing branch from the latest committed version of the main branch", async () => {
		const branchReader = createBranchReader();

		await expect(
			resolveElevenLabsAgentTargetForAgentId(
				{
					ELEVENLABS_AGENT_BRANCH_NAME: "preview/feature",
					ELEVENLABS_POST_CALL_WEBHOOK_ID: "wh_env",
					ELEVENLABS_WORKFLOW_NODE_ID: WORKFLOW_NODE_ID,
				},
				"agent_main_123",
				branchReader,
			),
		).resolves.toEqual({
			agentId: "agent_main_123",
			branchId: "agtbrch_created",
			workflowNodeId: WORKFLOW_NODE_ID,
			postCallWebhookId: "wh_env",
		});

		expect(branchReader.get).toHaveBeenCalledWith("agent_main_123", "agtbrch_main_123");
		expect(branchReader.create).toHaveBeenCalledWith("agent_main_123", {
			parentVersionId: "version_latest",
			name: "preview/feature",
			description: 'Branch "preview/feature", created automatically by Dialogbank.',
		});
	});

	it("points a created branch at this environment's webhook instead of the one copied from main", async () => {
		const branchReader = createBranchReader();

		await resolveElevenLabsAgentTargetForAgentId(
			{
				ELEVENLABS_AGENT_BRANCH_NAME: "preview/feature",
				ELEVENLABS_POST_CALL_WEBHOOK_ID: "wh_preview",
				ELEVENLABS_WORKFLOW_NODE_ID: WORKFLOW_NODE_ID,
			},
			"agent_main_123",
			branchReader,
		);

		expect(branchReader.setPostCallWebhook).toHaveBeenCalledWith(
			"agent_main_123",
			"agtbrch_created",
			"wh_preview",
		);
	});

	it("rejects without creating a branch when no webhook is configured", async () => {
		const branchReader = createBranchReader();

		await expect(
			resolveElevenLabsAgentTargetForAgentId(
				{
					ELEVENLABS_AGENT_BRANCH_NAME: "preview/feature",
					ELEVENLABS_WORKFLOW_NODE_ID: WORKFLOW_NODE_ID,
				},
				"agent_main_123",
				branchReader,
			),
		).rejects.toMatchObject({
			status: 500,
			body: { message: "ELEVENLABS_POST_CALL_WEBHOOK_ID is not configured on the server." },
		});
		expect(branchReader.create).not.toHaveBeenCalled();
	});

	it("uses the branch a concurrent request created when the name is taken", async () => {
		const branchReader = createBranchReader();
		branchReader.list
			.mockResolvedValueOnce([{ id: "agtbrch_main_123", name: "Main", isArchived: false }])
			.mockResolvedValueOnce([
				{ id: "agtbrch_main_123", name: "Main", isArchived: false },
				{ id: "agtbrch_concurrent", name: "preview/feature", isArchived: false },
			]);
		branchReader.create.mockRejectedValue(
			new ElevenLabsError({
				statusCode: 400,
				body: { detail: { type: "conflict", code: "conflict", message: "already exists" } },
			}),
		);

		await expect(
			resolveElevenLabsAgentTargetForAgentId(
				{
					ELEVENLABS_AGENT_BRANCH_NAME: "preview/feature",
					ELEVENLABS_POST_CALL_WEBHOOK_ID: "wh_env",
					ELEVENLABS_WORKFLOW_NODE_ID: WORKFLOW_NODE_ID,
				},
				"agent_main_123",
				branchReader,
			),
		).resolves.toMatchObject({ branchId: "agtbrch_concurrent" });
	});

	it("rethrows other errors from creating a branch", async () => {
		const branchReader = createBranchReader();
		const failure = new ElevenLabsError({ statusCode: 400, body: { detail: "invalid" } });
		branchReader.create.mockRejectedValue(failure);

		await expect(
			resolveElevenLabsAgentTargetForAgentId(
				{
					ELEVENLABS_AGENT_BRANCH_NAME: "preview/feature",
					ELEVENLABS_POST_CALL_WEBHOOK_ID: "wh_env",
					ELEVENLABS_WORKFLOW_NODE_ID: WORKFLOW_NODE_ID,
				},
				"agent_main_123",
				branchReader,
			),
		).rejects.toBe(failure);
		expect(branchReader.list).toHaveBeenCalledTimes(1);
	});

	it("rejects when there is no main branch to create a missing branch from", async () => {
		const branchReader = createBranchReader({ mainBranchId: undefined, branches: [] });

		await expect(
			resolveElevenLabsAgentTargetForAgentId(
				{
					ELEVENLABS_AGENT_BRANCH_NAME: "development",
					ELEVENLABS_POST_CALL_WEBHOOK_ID: "wh_env",
					ELEVENLABS_WORKFLOW_NODE_ID: WORKFLOW_NODE_ID,
				},
				"agent_main_123",
				branchReader,
			),
		).rejects.toMatchObject({
			status: 500,
			body: { message: "ElevenLabs agent agent_main_123 has no main branch." },
		});
		expect(branchReader.create).not.toHaveBeenCalled();
	});

	it("rejects when the main branch has no committed versions to branch from", async () => {
		const branchReader = createBranchReader({ mostRecentVersions: [] });

		await expect(
			resolveElevenLabsAgentTargetForAgentId(
				{
					ELEVENLABS_AGENT_BRANCH_NAME: "development",
					ELEVENLABS_POST_CALL_WEBHOOK_ID: "wh_env",
					ELEVENLABS_WORKFLOW_NODE_ID: WORKFLOW_NODE_ID,
				},
				"agent_main_123",
				branchReader,
			),
		).rejects.toMatchObject({
			status: 500,
			body: {
				message:
					'ElevenLabs branch "main" for agent agent_main_123 has no committed versions to branch from.',
			},
		});
	});

	it("rejects when the workflow node id is missing", async () => {
		await expect(
			resolveElevenLabsAgentTargetForAgentId(
				{ ELEVENLABS_AGENT_BRANCH_NAME: "main", ELEVENLABS_POST_CALL_WEBHOOK_ID: "wh_env" },
				"agent_main_123",
				createBranchReader(),
			),
		).rejects.toMatchObject({
			status: 500,
			body: { message: "ELEVENLABS_WORKFLOW_NODE_ID is not configured on the server." },
		});
	});
});

describe("resolveElevenLabsDialogbankAgentTag", () => {
	it("returns the configured Dialogbank agent tag", () => {
		expect(
			resolveElevenLabsDialogbankAgentTag({
				ELEVENLABS_DIALOGBANK_AGENT_TAG: "dialogbank-prod",
			}),
		).toBe("dialogbank-prod");
	});

	it("defaults to dialogbank", () => {
		expect(resolveElevenLabsDialogbankAgentTag({})).toBe("dialogbank");
	});
});

describe("listElevenLabsDialogbankAgents", () => {
	it("loads agents with the configured catalog tag", async () => {
		const entries: ElevenLabsAgentCatalogEntry[] = [
			{
				id: "agent_dialogbank_123",
				name: "Dialogbank Agent",
				voiceId: "voice_123",
				tags: ["dialogbank-prod"],
				archived: false,
			},
		];
		const list = vi.fn().mockResolvedValue(entries);

		await expect(
			listElevenLabsDialogbankAgents(
				{ ELEVENLABS_DIALOGBANK_AGENT_TAG: "dialogbank-prod" },
				{ list },
			),
		).resolves.toEqual(entries);

		expect(list).toHaveBeenCalledWith({ tag: "dialogbank-prod" });
	});
});

describe("getElevenLabsEditorAgent", () => {
	it("reads the configured branch and maps the editor payload", async () => {
		const prompt = "Stelle der Person nacheinander diese Fragen:\n\n1. Wie alt sind Sie?";
		const get = vi
			.fn<(agentId: string, request?: { branchId?: string }) => Promise<GetAgentResponseModel>>()
			.mockResolvedValue({
				name: "Dialogbank Test Agent",
				conversationConfig: {
					agent: {
						prompt: {
							prompt: "Ask one question at a time.",
						},
					},
				},
				workflow: makeWorkflow(prompt),
			} as GetAgentResponseModel);

		await expect(getElevenLabsEditorAgent(agentTarget, { get })).resolves.toEqual({
			id: "agent_main_123",
			branchId: "agtbrch_e2e_123",
			nodeAdditionalPrompt: prompt,
			dataCollection: {},
			questions: [{ text: "Wie alt sind Sie?", classifications: [] }],
		});

		expect(get).toHaveBeenCalledWith("agent_main_123", {
			branchId: "agtbrch_e2e_123",
		});
	});

	it("returns no questions when the workflow is missing", async () => {
		const get = vi
			.fn<(agentId: string, request?: { branchId?: string }) => Promise<GetAgentResponseModel>>()
			.mockResolvedValue({
				name: "Dialogbank Test Agent",
				conversationConfig: {},
			} as GetAgentResponseModel);

		await expect(getElevenLabsEditorAgent(agentTarget, { get })).resolves.toMatchObject({
			questions: [],
		});
	});

	it("extracts questions from the workflow node additional prompt", async () => {
		const prompt =
			"Stelle der Person nacheinander diese Fragen:\n\n1. Wie alt sind Sie?\n2. Was ist Ihr Beruf?";
		const get = vi
			.fn<(agentId: string, request?: { branchId?: string }) => Promise<GetAgentResponseModel>>()
			.mockResolvedValue({
				name: "Dialogbank Test Agent",
				conversationConfig: {},
				workflow: makeWorkflow(prompt),
			} as GetAgentResponseModel);

		await expect(getElevenLabsEditorAgent(agentTarget, { get })).resolves.toMatchObject({
			questions: [
				{ text: "Wie alt sind Sie?", classifications: [] },
				{ text: "Was ist Ihr Beruf?", classifications: [] },
			],
		});
	});

	it("attaches classifications from dataCollection to the matching question by index", async () => {
		const prompt =
			"Stelle der Person nacheinander diese Fragen:\n\n1. Wie alt sind Sie?\n2. Was ist Ihr Beruf?";
		const get = vi
			.fn<(agentId: string, request?: { branchId?: string }) => Promise<GetAgentResponseModel>>()
			.mockResolvedValue({
				name: "Dialogbank Test Agent",
				conversationConfig: {},
				workflow: makeWorkflow(prompt),
				platformSettings: {
					dataCollection: {
						question_0: {
							type: "string",
							description: 'Wie hat die Person auf die Frage "Wie alt sind Sie?" geantwortet?',
						},
						classification_0: {
							type: "string",
							description:
								'Wie kann die Antwort auf die Frage "Wie alt sind Sie?" klassifiziert werden:\n\njung: jung\nmittel: mittel\nalt: alt\n',
							enum: ["jung", "mittel", "alt"],
						},
						question_1: {
							type: "string",
							description: 'Wie hat die Person auf die Frage "Was ist Ihr Beruf?" geantwortet?',
						},
					},
				},
			} as unknown as GetAgentResponseModel);

		await expect(getElevenLabsEditorAgent(agentTarget, { get })).resolves.toMatchObject({
			questions: [
				{ text: "Wie alt sind Sie?", classifications: ["jung", "mittel", "alt"] },
				{ text: "Was ist Ihr Beruf?", classifications: [] },
			],
		});
	});
});

describe("parseQuestionsFromWorkflowNodePrompt", () => {
	it("returns an empty array when the prompt does not start with the preamble", () => {
		expect(parseQuestionsFromWorkflowNodePrompt("Some other prompt")).toEqual([]);
	});

	it("returns an empty array for an empty string", () => {
		expect(parseQuestionsFromWorkflowNodePrompt("")).toEqual([]);
	});

	it("parses a single question", () => {
		const prompt = "Stelle der Person nacheinander diese Fragen:\n\n1. Wie alt sind Sie?";
		expect(parseQuestionsFromWorkflowNodePrompt(prompt)).toEqual(["Wie alt sind Sie?"]);
	});

	it("parses multiple questions in order", () => {
		const prompt =
			"Stelle der Person nacheinander diese Fragen:\n\n1. Wie alt sind Sie?\n2. Was ist Ihr Beruf?\n3. Woher kommen Sie?";
		expect(parseQuestionsFromWorkflowNodePrompt(prompt)).toEqual([
			"Wie alt sind Sie?",
			"Was ist Ihr Beruf?",
			"Woher kommen Sie?",
		]);
	});

	it("parses the real-world prompt with five questions", () => {
		const prompt =
			"Stelle der Person nacheinander diese Fragen:\n\n1. So, erst mal zu Dir: Woher kommst Du eigentlich genau?\n2. Jetzt sag mal ehrlich: Wie gefällt Dir die Innenstadt von Gelsenkirchen so?\n3. Stell Dir mal vor: Wenn Du OB von Gelsenkirchen wärst – was würdest Du als Erstes verbessern?\n4. Nun mal kurz zu uns: Was hältst Du davon, dass wir vom WDR mit dem PopUp Studio gerade hier in Gelsenkirchen sind?\n5. Und mal ganz grundsätzlich gefragt: Wie findest Du den WDR im Allgemeinen?";
		expect(parseQuestionsFromWorkflowNodePrompt(prompt)).toEqual([
			"So, erst mal zu Dir: Woher kommst Du eigentlich genau?",
			"Jetzt sag mal ehrlich: Wie gefällt Dir die Innenstadt von Gelsenkirchen so?",
			"Stell Dir mal vor: Wenn Du OB von Gelsenkirchen wärst – was würdest Du als Erstes verbessern?",
			"Nun mal kurz zu uns: Was hältst Du davon, dass wir vom WDR mit dem PopUp Studio gerade hier in Gelsenkirchen sind?",
			"Und mal ganz grundsätzlich gefragt: Wie findest Du den WDR im Allgemeinen?",
		]);
	});
});

describe("buildWorkflowNodeAdditionalPrompt", () => {
	it("builds a prompt with the preamble and a numbered list", () => {
		const result = buildWorkflowNodeAdditionalPrompt(["Wie alt sind Sie?", "Was ist Ihr Beruf?"]);
		expect(result).toBe(
			"Stelle der Person nacheinander diese Fragen:\n\n1. Wie alt sind Sie?\n2. Was ist Ihr Beruf?",
		);
	});

	it("round-trips through parse", () => {
		const questions = ["Frage A?", "Frage B?", "Frage C?"];
		const prompt = buildWorkflowNodeAdditionalPrompt(questions);
		expect(parseQuestionsFromWorkflowNodePrompt(prompt)).toEqual(questions);
	});
});

describe("parseQuestionsFromDataCollection", () => {
	it("returns an empty array when dataCollection is undefined", () => {
		expect(parseQuestionsFromDataCollection(undefined)).toEqual([]);
	});

	it("returns an empty array when there are no question_ entries", () => {
		const dataCollection: Record<string, AnalysisProperty> = {
			first_name: { type: "string", description: "What is the first name?" },
		};
		expect(parseQuestionsFromDataCollection(dataCollection)).toEqual([]);
	});

	it("extracts question text from the description field", () => {
		const dataCollection: Record<string, AnalysisProperty> = {
			question_0: {
				type: "string",
				description: 'Wie hat die Person auf die Frage "Wie alt sind Sie?" geantwortet?',
			},
			question_1: {
				type: "string",
				description: 'Wie hat die Person auf die Frage "Was ist Ihr Beruf?" geantwortet?',
			},
		};

		expect(parseQuestionsFromDataCollection(dataCollection)).toEqual([
			"Wie alt sind Sie?",
			"Was ist Ihr Beruf?",
		]);
	});

	it("ignores classification_ and other non-question entries", () => {
		const dataCollection: Record<string, AnalysisProperty> = {
			question_0: {
				type: "string",
				description: 'Wie hat die Person auf die Frage "Wie alt sind Sie?" geantwortet?',
			},
			classification_0: {
				type: "string",
				description: 'Wie kann die Antwort auf die Frage "Wie alt sind Sie?" klassifiziert werden',
				enum: ["jung", "alt"],
			},
			publication_allowed: { type: "boolean" as "string" },
		};

		expect(parseQuestionsFromDataCollection(dataCollection)).toEqual(["Wie alt sind Sie?"]);
	});

	it("returns questions sorted by key", () => {
		const dataCollection: Record<string, AnalysisProperty> = {
			question_1: {
				type: "string",
				description: 'Wie hat die Person auf die Frage "Zweite Frage?" geantwortet?',
			},
			question_0: {
				type: "string",
				description: 'Wie hat die Person auf die Frage "Erste Frage?" geantwortet?',
			},
		};

		expect(parseQuestionsFromDataCollection(dataCollection)).toEqual([
			"Erste Frage?",
			"Zweite Frage?",
		]);
	});
});

describe("buildQuestionDataCollectionEntries", () => {
	it("returns an empty object for an empty questions array", () => {
		expect(buildQuestionDataCollectionEntries([])).toEqual({});
	});

	it("builds question entries with the correct description format", () => {
		const entries = buildQuestionDataCollectionEntries([
			makeQuestion("Wie alt sind Sie?"),
			makeQuestion("Was ist Ihr Beruf?"),
		]);

		expect(entries).toEqual({
			question_0: {
				type: "string",
				description: 'Wie hat die Person auf die Frage "Wie alt sind Sie?" geantwortet?',
			},
			question_1: {
				type: "string",
				description: 'Wie hat die Person auf die Frage "Was ist Ihr Beruf?" geantwortet?',
			},
		});
	});

	it("adds a classification entry when the question has classifications", () => {
		const entries = buildQuestionDataCollectionEntries([
			makeQuestion("Wie alt sind Sie?", ["jung", "mittel", "alt"]),
		]);

		expect(entries).toEqual({
			question_0: {
				type: "string",
				description: 'Wie hat die Person auf die Frage "Wie alt sind Sie?" geantwortet?',
			},
			classification_0: {
				type: "string",
				description:
					'Wie kann die Antwort auf die Frage "Wie alt sind Sie?" klassifiziert werden:\n\njung: jung\nmittel: mittel\nalt: alt\n',
				enum: ["jung", "mittel", "alt"],
			},
		});
	});

	it("omits the classification entry when the question has no classifications", () => {
		const entries = buildQuestionDataCollectionEntries([makeQuestion("Wie alt sind Sie?")]);
		expect(entries).not.toHaveProperty("classification_0");
	});

	it("only creates classification entries for questions that have them", () => {
		const entries = buildQuestionDataCollectionEntries([
			makeQuestion("Erste Frage?"),
			makeQuestion("Zweite Frage?", ["Ja", "Nein"]),
		]);

		expect(entries).not.toHaveProperty("classification_0");
		expect(entries).toHaveProperty("classification_1");
		expect(entries.classification_1).toMatchObject({ enum: ["ja", "nein"] });
	});
});

describe("updateElevenLabsAgentQuestions", () => {
	function makeWriter() {
		return {
			update: vi
				.fn<
					(
						agentId: string,
						request: {
							branchId?: string;
							platformSettings?: {
								dataCollection?: Record<string, AnalysisProperty>;
								workspaceOverrides?: { webhooks: { postCallWebhookId: string | null } };
							};
							workflow?: unknown;
						},
					) => Promise<{ versionId?: string }>
				>()
				.mockResolvedValue({ versionId: "agtvrsn_test" }),
		};
	}

	it("updates the workflow node additional prompt", async () => {
		const writer = makeWriter();
		const existingAgent: AgentReaderResponse = {
			name: "Test",
			conversationConfig: {},
			workflow: makeWorkflow("Stelle der Person nacheinander diese Fragen:\n\n1. Alte Frage?"),
		};

		await updateElevenLabsAgentQuestions(
			agentTarget,
			[makeQuestion("Neue Frage?")],
			existingAgent,
			writer,
		);

		const calledWith = writer.update.mock.calls[0][1];
		const updatedNode = (calledWith.workflow as AgentWorkflowResponseModel)?.nodes[
			WORKFLOW_NODE_ID
		];
		expect(updatedNode).toMatchObject({
			type: "override_agent",
			additionalPrompt: "Stelle der Person nacheinander diese Fragen:\n\n1. Neue Frage?",
		});
	});

	it("returns the committed agent version", async () => {
		const writer = makeWriter();
		const existingAgent: AgentReaderResponse = {
			name: "Test",
			conversationConfig: {},
			workflow: makeWorkflow("Stelle der Person nacheinander diese Fragen:\n\n1. Frage?"),
		};

		await expect(
			updateElevenLabsAgentQuestions(agentTarget, [makeQuestion("Frage?")], existingAgent, writer),
		).resolves.toBe("agtvrsn_test");
	});

	it.each([
		["this environment's webhook", "wh_env"],
		["no webhook", null],
	])("points the configured branch at %s", async (_, postCallWebhookId) => {
		const writer = makeWriter();
		const existingAgent: AgentReaderResponse = {
			name: "Test",
			conversationConfig: {},
			workflow: makeWorkflow("Stelle der Person nacheinander diese Fragen:\n\n1. Frage?"),
		};

		await updateElevenLabsAgentQuestions(
			{ ...agentTarget, postCallWebhookId },
			[makeQuestion("Frage?")],
			existingAgent,
			writer,
		);

		expect(writer.update.mock.calls[0][1].platformSettings?.workspaceOverrides).toEqual({
			webhooks: { postCallWebhookId },
		});
	});

	it("preserves all other workflow nodes unchanged", async () => {
		const writer = makeWriter();
		const otherNodeId = "node_other_abc";
		const existingAgent: AgentReaderResponse = {
			name: "Test",
			conversationConfig: {},
			workflow: {
				preventSubagentLoops: false,
				edges: {},
				nodes: {
					[WORKFLOW_NODE_ID]: makeOverrideAgentNode(
						"Stelle der Person nacheinander diese Fragen:\n\n1. Frage?",
					),
					[otherNodeId]: { type: "end" as const, position: { x: 0, y: 0 }, edgeOrder: [] },
				},
			},
		};

		await updateElevenLabsAgentQuestions(
			agentTarget,
			[makeQuestion("Frage?")],
			existingAgent,
			writer,
		);

		const calledWith = writer.update.mock.calls[0][1];
		const nodes = (calledWith.workflow as AgentWorkflowResponseModel)?.nodes;
		expect(Object.keys(nodes)).toContain(otherNodeId);
	});

	it("syncs questions to dataCollection", async () => {
		const writer = makeWriter();
		const existingAgent: AgentReaderResponse = {
			name: "Test",
			conversationConfig: {},
			workflow: makeWorkflow("Stelle der Person nacheinander diese Fragen:\n\n1. Alte Frage?"),
			platformSettings: {
				dataCollection: {
					first_name: { type: "string", description: "What is the first name?" },
				},
			},
		};

		await updateElevenLabsAgentQuestions(
			agentTarget,
			[makeQuestion("Neue Frage?")],
			existingAgent,
			writer,
		);

		const calledWith = writer.update.mock.calls[0][1];
		expect(calledWith.platformSettings?.dataCollection).toMatchObject({
			first_name: { type: "string", description: "What is the first name?" },
			question_0: {
				type: "string",
				description: 'Wie hat die Person auf die Frage "Neue Frage?" geantwortet?',
			},
		});
	});

	it("removes an assignment id written by earlier versions and keeps other entries", async () => {
		const writer = makeWriter();
		const existingAgent: AgentReaderResponse = {
			name: "Test",
			conversationConfig: {},
			platformSettings: {
				dataCollection: {
					assignment_id: { type: "string", constantValue: "42" },
					first_name: { type: "string", description: "What is the first name?" },
				},
			},
			workflow: makeWorkflow("Stelle der Person nacheinander diese Fragen:\n\n1. Frage?"),
		};

		await updateElevenLabsAgentQuestions(
			agentTarget,
			[makeQuestion("Frage?")],
			existingAgent,
			writer,
		);

		const dataCollection = writer.update.mock.calls[0][1].platformSettings?.dataCollection;
		expect(dataCollection).not.toHaveProperty("assignment_id");
		expect(dataCollection).toHaveProperty("first_name");
	});

	it("writes classification entries to dataCollection for questions that have them", async () => {
		const writer = makeWriter();
		const existingAgent: AgentReaderResponse = {
			name: "Test",
			conversationConfig: {},
			workflow: makeWorkflow("Stelle der Person nacheinander diese Fragen:\n\n1. Frage?"),
		};

		await updateElevenLabsAgentQuestions(
			agentTarget,
			[makeQuestion("Frage?", ["Option A", "Option B"])],
			existingAgent,
			writer,
		);

		const calledWith = writer.update.mock.calls[0][1];
		expect(calledWith.platformSettings?.dataCollection).toMatchObject({
			classification_0: {
				type: "string",
				description:
					'Wie kann die Antwort auf die Frage "Frage?" klassifiziert werden:\n\noption-a: Option A\noption-b: Option B\n',
				enum: ["option-a", "option-b"],
			},
		});
	});

	it("removes stale classification entries when classifications are cleared", async () => {
		const writer = makeWriter();
		const existingAgent: AgentReaderResponse = {
			name: "Test",
			conversationConfig: {},
			workflow: makeWorkflow("Stelle der Person nacheinander diese Fragen:\n\n1. Frage?"),
			platformSettings: {
				dataCollection: {
					question_0: {
						type: "string",
						description: 'Wie hat die Person auf die Frage "Frage?" geantwortet?',
					},
					classification_0: {
						type: "string",
						description: 'Wie kann die Antwort auf die Frage "Frage?" klassifiziert werden',
						enum: ["Alt", "Neu"],
					},
				},
			},
		};

		await updateElevenLabsAgentQuestions(
			agentTarget,
			[makeQuestion("Frage?")],
			existingAgent,
			writer,
		);

		const calledWith = writer.update.mock.calls[0][1];
		expect(calledWith.platformSettings?.dataCollection).not.toHaveProperty("classification_0");
	});

	it("throws when the workflow node does not exist", async () => {
		const writer = makeWriter();
		const existingAgent: AgentReaderResponse = {
			name: "Test",
			conversationConfig: {},
			workflow: { preventSubagentLoops: false, edges: {}, nodes: {} },
		};

		await expect(
			updateElevenLabsAgentQuestions(agentTarget, [makeQuestion("Frage?")], existingAgent, writer),
		).rejects.toMatchObject({ status: 500 });
	});

	it("throws when the workflow is missing", async () => {
		const writer = makeWriter();
		const existingAgent: AgentReaderResponse = {
			name: "Test",
			conversationConfig: {},
		};

		await expect(
			updateElevenLabsAgentQuestions(agentTarget, [makeQuestion("Frage?")], existingAgent, writer),
		).rejects.toMatchObject({ status: 500 });
	});
});
