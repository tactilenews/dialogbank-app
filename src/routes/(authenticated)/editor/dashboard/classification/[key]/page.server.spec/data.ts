import type { answers, classifications, conversations } from "$lib/server/db/schema";

type InsertConversation = typeof conversations.$inferInsert;
type InsertAnswer = typeof answers.$inferInsert;
type InsertClassification = typeof classifications.$inferInsert;

// Unique IDs to avoid collisions with parallel spec files sharing the same PGlite instance
export const classificationDetailClassifications: InsertClassification[] = [
	{ id: 101, key: "support", label: "Support" },
	{ id: 102, key: "idea", label: "Idea" },
];

export const classificationDetailConversations: InsertConversation[] = [
	{
		conversationId: "conv-detail-1",
		agentId: "agent-detail",
		assignmentId: 1,
		firstName: "Lena",
		lastName: "Müller",
		publicationAllowed: true,
		callSuccessful: "success",
		summary: "Detail spec conversation one",
	},
	{
		conversationId: "conv-detail-2",
		agentId: "agent-detail",
		assignmentId: 1,
		firstName: "Felix",
		lastName: "Wagner",
		publicationAllowed: true,
		callSuccessful: "success",
		summary: "Detail spec conversation two",
	},
];

export const classificationDetailAnswers: InsertAnswer[] = [
	{
		id: 1001,
		conversationId: "conv-detail-1",
		dataCollectionId: "detail-support-1",
		value: "Gelsenkirchen hat gute Verkehrsverbindungen.",
		classificationId: 101,
		rationale: "Positive Bewertung",
	},
	{
		id: 1002,
		conversationId: "conv-detail-2",
		dataCollectionId: "detail-support-2",
		value: "Der ÖPNV ist gut ausgebaut.",
		classificationId: 101,
		rationale: "Positive Bewertung",
	},
	{
		id: 1003,
		conversationId: "conv-detail-1",
		dataCollectionId: "detail-unclassified-1",
		value: "Noch keine Klassifizierung.",
		rationale: "Offen",
	},
];
