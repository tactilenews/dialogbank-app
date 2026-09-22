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
	type ElevenLabsEnv,
	getElevenLabsEditorAgent,
	isSelectableDialogbankAgent,
	listElevenLabsDialogbankAgents,
	parseQuestionsFromDataCollection,
	parseQuestionsFromWorkflowNodePrompt,
	type Question,
	removeElevenLabsAgentAssignment,
	resolveElevenLabsAgentTarget,
	resolveElevenLabsAgentTargetForAgentId,
	resolveElevenLabsDialogbankAgentTag,
	updateElevenLabsAgentQuestions,
} from "./agent";

const WORKFLOW_NODE_ID = "node_e2e_12345";

const agentTarget = {
	agentId: "agent_main_123",
	branchId: "agtbrch_e2e_123",
	workflowNodeId: WORKFLOW_NODE_ID,
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

describe("resolveElevenLabsAgentTarget", () => {
	it("returns the configured agent, branch, and workflow node ids", async () => {
		const environment: ElevenLabsEnv = {
			ELEVENLABS_AGENT_ID: "agent_main_123",
			ELEVENLABS_AGENT_BRANCH_ID: "agtbrch_main_123",
			ELEVENLABS_WORKFLOW_NODE_ID: WORKFLOW_NODE_ID,
		};

		await expect(resolveElevenLabsAgentTarget(environment)).resolves.toEqual({
			agentId: "agent_main_123",
			branchId: "agtbrch_main_123",
			workflowNodeId: WORKFLOW_NODE_ID,
		});
	});

	it("resolves the development branch by name outside production", async () => {
		const environment: ElevenLabsEnv = {
			ELEVENLABS_AGENT_ID: "agent_main_123",
			ELEVENLABS_WORKFLOW_NODE_ID: WORKFLOW_NODE_ID,
		};
		const branchReader = {
			list: vi.fn().mockResolvedValue([
				{ id: "agtbrch_main_123", name: "main", isArchived: false },
				{ id: "agtbrch_dev_123", name: "development", isArchived: false },
			]),
			get: vi.fn(),
			create: vi.fn(),
		};

		await expect(
			resolveElevenLabsAgentTargetForAgentId(environment, "agent_main_123", branchReader),
		).resolves.toEqual({
			agentId: "agent_main_123",
			branchId: "agtbrch_dev_123",
			workflowNodeId: WORKFLOW_NODE_ID,
		});
	});

	it("does not apply another agent's explicit CI branch", async () => {
		const branchReader = {
			list: vi
				.fn()
				.mockResolvedValue([{ id: "agtbrch_other_dev", name: "development", isArchived: false }]),
			get: vi.fn(),
			create: vi.fn(),
		};

		await expect(
			resolveElevenLabsAgentTargetForAgentId(
				{
					ELEVENLABS_AGENT_ID: "agent_ci_fixture",
					ELEVENLABS_AGENT_BRANCH_ID: "agtbrch_ci_fixture",
					ELEVENLABS_WORKFLOW_NODE_ID: WORKFLOW_NODE_ID,
				},
				"agent_other",
				branchReader,
			),
		).resolves.toMatchObject({
			agentId: "agent_other",
			branchId: "agtbrch_other_dev",
		});
	});

	it("resolves the main branch by name in production", async () => {
		const branchReader = {
			list: vi.fn().mockResolvedValue([
				{ id: "agtbrch_main_123", name: "main", isArchived: false },
				{ id: "agtbrch_dev_123", name: "development", isArchived: false },
			]),
			get: vi.fn(),
			create: vi.fn(),
		};

		await expect(
			resolveElevenLabsAgentTargetForAgentId(
				{
					NODE_ENV: "production",
					ELEVENLABS_WORKFLOW_NODE_ID: WORKFLOW_NODE_ID,
				},
				"agent_main_123",
				branchReader,
			),
		).resolves.toMatchObject({ branchId: "agtbrch_main_123" });
	});

	it("rejects when neither the expected branch nor a main branch to fork from exists", async () => {
		await expect(
			resolveElevenLabsAgentTargetForAgentId(
				{ ELEVENLABS_WORKFLOW_NODE_ID: WORKFLOW_NODE_ID },
				"agent_main_123",
				{ list: vi.fn().mockResolvedValue([]), get: vi.fn(), create: vi.fn() },
			),
		).rejects.toMatchObject({
			status: 500,
			body: {
				message: 'ElevenLabs branch "main" was not found for agent agent_main_123.',
			},
		});
	});

	it("rejects when the production main branch is missing", async () => {
		await expect(
			resolveElevenLabsAgentTargetForAgentId(
				{ NODE_ENV: "production", ELEVENLABS_WORKFLOW_NODE_ID: WORKFLOW_NODE_ID },
				"agent_main_123",
				{ list: vi.fn().mockResolvedValue([]), get: vi.fn(), create: vi.fn() },
			),
		).rejects.toMatchObject({
			status: 500,
			body: {
				message: 'ElevenLabs branch "main" was not found for agent agent_main_123.',
			},
		});
	});

	it("creates the development branch from main when it does not exist yet", async () => {
		const branchReader = {
			list: vi
				.fn()
				.mockResolvedValue([{ id: "agtbrch_main_123", name: "main", isArchived: false }]),
			get: vi.fn().mockResolvedValue({
				mostRecentVersions: [
					{ id: "version_older", seqNoInBranch: 1, timeCommittedSecs: 100 },
					{ id: "version_latest", seqNoInBranch: 2, timeCommittedSecs: 200 },
				],
			}),
			create: vi.fn().mockResolvedValue({
				createdBranchId: "agtbrch_dev_new",
				createdVersionId: "version_new",
			}),
		};

		await expect(
			resolveElevenLabsAgentTargetForAgentId(
				{ ELEVENLABS_WORKFLOW_NODE_ID: WORKFLOW_NODE_ID },
				"agent_main_123",
				branchReader,
			),
		).resolves.toEqual({
			agentId: "agent_main_123",
			branchId: "agtbrch_dev_new",
			workflowNodeId: WORKFLOW_NODE_ID,
		});

		expect(branchReader.get).toHaveBeenCalledWith("agent_main_123", "agtbrch_main_123");
		expect(branchReader.create).toHaveBeenCalledWith("agent_main_123", {
			parentVersionId: "version_latest",
			name: "development",
			description: "Development branch, created automatically by Dialogbank.",
		});
	});

	it("rejects when the main branch has no committed versions to branch from", async () => {
		const branchReader = {
			list: vi
				.fn()
				.mockResolvedValue([{ id: "agtbrch_main_123", name: "main", isArchived: false }]),
			get: vi.fn().mockResolvedValue({ mostRecentVersions: [] }),
			create: vi.fn(),
		};

		await expect(
			resolveElevenLabsAgentTargetForAgentId(
				{ ELEVENLABS_WORKFLOW_NODE_ID: WORKFLOW_NODE_ID },
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
		const environment: ElevenLabsEnv = {
			ELEVENLABS_AGENT_ID: "agent_main_123",
			ELEVENLABS_AGENT_BRANCH_ID: "agtbrch_main_123",
		};

		await expect(resolveElevenLabsAgentTarget(environment)).rejects.toMatchObject({
			status: 500,
			body: {
				message: "ELEVENLABS_WORKFLOW_NODE_ID is not configured on the server.",
			},
		});
	});
});

describe("resolveElevenLabsAgentTargetForAgentId", () => {
	it("uses an explicit branch for its configured agent", async () => {
		await expect(
			resolveElevenLabsAgentTargetForAgentId(
				{
					ELEVENLABS_AGENT_ID: "agent_assignment_123",
					ELEVENLABS_AGENT_BRANCH_ID: "agtbrch_main_123",
					ELEVENLABS_WORKFLOW_NODE_ID: WORKFLOW_NODE_ID,
				},
				"agent_assignment_123",
			),
		).resolves.toEqual({
			agentId: "agent_assignment_123",
			branchId: "agtbrch_main_123",
			workflowNodeId: WORKFLOW_NODE_ID,
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

	it("writes the assignment id as a constant data collection value", async () => {
		const writer = makeWriter();
		const existingAgent: AgentReaderResponse = {
			name: "Test",
			conversationConfig: {},
			workflow: makeWorkflow("Stelle der Person nacheinander diese Fragen:\n\n1. Frage?"),
		};

		await updateElevenLabsAgentQuestions(
			agentTarget,
			[makeQuestion("Frage?")],
			existingAgent,
			writer,
			{ assignmentId: 42 },
		);

		expect(writer.update.mock.calls[0][1].platformSettings?.dataCollection).toMatchObject({
			assignment_id: { type: "string", constantValue: "42" },
		});
	});

	it("removes only the assignment id when disconnecting", async () => {
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
		};

		await removeElevenLabsAgentAssignment(agentTarget, existingAgent, writer);

		expect(writer.update).toHaveBeenCalledWith(agentTarget.agentId, {
			branchId: agentTarget.branchId,
			platformSettings: {
				dataCollection: {
					first_name: { type: "string", description: "What is the first name?" },
				},
			},
		});
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
