import type { schema } from "../lib/db";

type ConversationInsert = typeof schema.conversations.$inferInsert;
type AnswerInsert = typeof schema.answers.$inferInsert;

export const conversations: ConversationInsert[] = [
	{
		conversationId: "conv_6401kkgz0tzkebb98yrw4bfpcwkb",
		agentId: "agent_0501kjanbz0qe07rt0vnskaz2aag",
		firstName: "Robert",
		lastName: null,
		age: null,
		publicationAllowed: true,
		callSuccessful: "success",
		summary: "The WDR AI, Nadia, interviewed Robert, who is from Cologne.",
	},
];

export const answers: AnswerInsert[] = [
	{
		id: 201,
		conversationId: "conv_6401kkgz0tzkebb98yrw4bfpcwkb",
		dataCollectionId: "answer_5",
		value:
			"Ich mag den WDR. Der hat zum Beispiel Quarks und die Sendung mit der Maus. Das sind ganz gute Formate.",
		rationale:
			"Der Nutzer antwortet auf die Frage 'Wie findest du den WDR im Allgemeinen?' mit 'Ich mag den WDR.'",
		classification: null,
	},
	{
		id: 202,
		conversationId: "conv_6401kkgz0tzkebb98yrw4bfpcwkb",
		dataCollectionId: "answer_2",
		value: "Ja, ist jetzt nicht so hübsch.",
		rationale:
			"Der Nutzer antwortet auf die Frage 'Wie gefällt dir die Innenstadt von Gelsenkirchen so?' mit 'Ja, ist jetzt nicht so hübsch.'.",
		classification: "conGelsenkirchen",
	},
];
