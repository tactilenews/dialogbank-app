import type { PageData } from "../$types";

export const assignmentEditorPageData: PageData = {
	user: {
		id: "user-1",
		name: "Editor",
		email: "editor@example.com",
	},
	assignment: {
		id: 1,
		name: "Innenstadt",
		slug: "innenstadt",
		location: null,
		client: null,
		promptSupplement: null,
		elevenLabsAgentId: "agent_current",
		elevenLabsAgentVersionId: "agtvrsn_current",
		agentConfiguredAt: new Date("2026-09-20T12:00:00.000Z"),
		agentConfigurationError: null,
		createdAt: new Date("2026-09-20T00:00:00.000Z"),
		updatedAt: new Date("2026-09-20T00:00:00.000Z"),
	},
	questions: [],
	allClassifications: [],
	availableAgents: [
		{
			id: "agent_current",
			name: "Nadia",
			voiceId: "voice_nadia",
			tags: ["dialogbank"],
			archived: false,
		},
		{
			id: "agent_available",
			name: "Mara",
			voiceId: "voice_mara",
			tags: ["dialogbank"],
			archived: false,
		},
	],
	unavailableAgents: [
		{
			id: "agent_unavailable",
			name: "Tom",
			voiceId: "voice_tom",
			tags: ["dialogbank"],
			archived: false,
			assignmentId: 2,
			assignmentName: "Bahnhof",
		},
	],
	agentCatalogTag: "dialogbank",
	agentCatalogError: null,
	agent: null,
};
