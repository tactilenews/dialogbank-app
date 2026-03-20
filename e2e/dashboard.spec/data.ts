import type { schema } from "../lib/db";

type ConversationInsert = typeof schema.conversations.$inferInsert;
type AnswerInsert = typeof schema.answers.$inferInsert;
type ClassificationInsert = typeof schema.classifications.$inferInsert;

export const classifications: ClassificationInsert[] = [
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

export const conversations: ConversationInsert[] = [
	{
		conversationId: "conv-dashboard-1",
		agentId: "agent-dashboard",
		firstName: "Mara",
		lastName: "Klein",
		publicationAllowed: true,
		callSuccessful: "success",
		summary: "Dashboard conversation one",
	},
	{
		conversationId: "conv-dashboard-2",
		agentId: "agent-dashboard",
		firstName: "Jonas",
		lastName: "Becker",
		publicationAllowed: true,
		callSuccessful: "success",
		summary: "Dashboard conversation two",
	},
];

export const answers: AnswerInsert[] = [
	{
		id: 301,
		conversationId: "conv-dashboard-1",
		dataCollectionId: "answer-unclassified",
		value: "This answer still needs a classification.",
		rationale: "The statement is unclear and needs an editor decision.",
	},
	{
		id: 302,
		conversationId: "conv-dashboard-2",
		dataCollectionId: "answer-con",
		value: "The city center feels neglected.",
		rationale: "The answer clearly expresses a negative assessment.",
		classificationId: 3,
	},
];
