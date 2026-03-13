import type { answers, conversations } from "$lib/server/db/schema";

type InsertConversation = typeof conversations.$inferInsert;
type InsertAnswer = typeof answers.$inferInsert;

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
		classification: "proGelsenkirchen",
		rationale: "Positive remark",
	},
	{
		conversationId: "conv-legacy-1",
		dataCollectionId: "answer_2",
		value: "Mehr Parks in der Stadt.",
		classification: "ideaGelsenkirchen",
		rationale: "Idea",
	},
	{
		conversationId: "conv-legacy-2",
		dataCollectionId: "answer_1",
		value: "Zu wenig Licht.",
		classification: "conGelsenkirchen",
		rationale: "Negative remark",
	},
];
