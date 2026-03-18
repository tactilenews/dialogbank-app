import type { answers, classifications, conversations } from "$lib/server/db/schema";

type InsertConversation = typeof conversations.$inferInsert;
type InsertAnswer = typeof answers.$inferInsert;
type InsertClassification = typeof classifications.$inferInsert;

export const sampleClassifications: InsertClassification[] = [
	{
		id: 1,
		key: "proGelsenkirchen",
		label: "Pro Gelsenkirchen",
	},
	{
		id: 2,
		key: "ideaGelsenkirchen",
		label: "Idea Gelsenkirchen",
	},
	{
		id: 3,
		key: "conGelsenkirchen",
		label: "Contra Gelsenkirchen",
	},
];

export const sampleConversations: InsertConversation[] = [
	{
		conversationId: "conv-legacy-1",
		agentId: "agent-legacy",
		firstName: "Mara",
		lastName: "Klein",
		age: 32,
		publicationAllowed: true,
		callSuccessful: "success",
		summary: "Summary one",
	},
	{
		conversationId: "conv-legacy-2",
		agentId: "agent-legacy",
		firstName: "Jonas",
		lastName: "Becker",
		age: 44,
		publicationAllowed: false,
		callSuccessful: "success",
		summary: "Summary two",
	},
];

export const sampleAnswers: InsertAnswer[] = [
	{
		conversationId: "conv-legacy-1",
		dataCollectionId: "answer_1",
		value: "Schalke hat Herz.",
		classificationId: 1,
		rationale: "Positive remark",
	},
	{
		conversationId: "conv-legacy-1",
		dataCollectionId: "answer_2",
		value: "Mehr Parks in der Stadt.",
		classificationId: 2,
		rationale: "Idea",
	},
	{
		conversationId: "conv-legacy-2",
		dataCollectionId: "answer_1",
		value: "Zu wenig Licht.",
		classificationId: 3,
		rationale: "Negative remark",
	},
];
