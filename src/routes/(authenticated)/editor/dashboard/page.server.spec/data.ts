import type { answers, classifications, conversations } from "$lib/server/db/schema";

type InsertConversation = typeof conversations.$inferInsert;
type InsertAnswer = typeof answers.$inferInsert;
type InsertClassification = typeof classifications.$inferInsert;

export const sampleClassifications: InsertClassification[] = [
	{
		id: 1,
		key: "support",
		label: "Support",
	},
	{
		id: 2,
		key: "idea",
		label: "Idea",
	},
];

export const sampleConversations: InsertConversation[] = [
	{
		conversationId: "conv-editor-1",
		agentId: "agent-editor",
		assignmentId: 1,
		firstName: "Mara",
		lastName: "Klein",
		publicationAllowed: true,
		callSuccessful: "success",
		summary: "Summary one",
	},
	{
		conversationId: "conv-editor-2",
		agentId: "agent-editor",
		assignmentId: 1,
		firstName: "Jonas",
		lastName: "Becker",
		publicationAllowed: true,
		callSuccessful: "failed",
		summary: "Summary two",
	},
];

export const sampleAnswersWithSlugCollisions: InsertAnswer[] = [
	{
		id: 1,
		conversationId: "conv-editor-1",
		dataCollectionId: "answer-support-1",
		value: "Support answer one",
		classificationId: 1,
		rationale: "Support",
	},
	{
		id: 2,
		conversationId: "conv-editor-2",
		dataCollectionId: "answer-support-2",
		value: "Support answer two",
		classificationId: 1,
		rationale: "Support",
	},
	{
		id: 3,
		conversationId: "conv-editor-1",
		dataCollectionId: "answer-a-b-1",
		value: "AB answer one",
		classificationId: 2,
		rationale: "Idea",
	},
	{
		id: 4,
		conversationId: "conv-editor-2",
		dataCollectionId: "answer-a-b-2",
		value: "AB answer two",
		classificationId: 2,
		rationale: "Idea",
	},
	{
		id: 5,
		conversationId: "conv-editor-1",
		dataCollectionId: "answer-unclassified-1",
		value: "This answer still needs a classification.",
		rationale: "Missing classification",
	},
];

export const paginatedSupportAnswers: InsertAnswer[] = Array.from({ length: 21 }, (_, index) => ({
	conversationId: index % 2 === 0 ? "conv-editor-1" : "conv-editor-2",
	dataCollectionId: `answer-page-${index + 1}`,
	value: `Paged support answer ${index + 1}`,
	classificationId: 1,
	rationale: "Support pagination",
}));
