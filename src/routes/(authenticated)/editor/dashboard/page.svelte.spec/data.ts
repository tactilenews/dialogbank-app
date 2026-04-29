import type { PageData } from "../$types";

export const sampleEditorPageData: PageData = {
	user: {
		id: "user-1",
		name: "Editor",
		email: "editor@example.com",
	},
	successfulConversations: 3,
	totalAnswers: 6,
	conversationsPerDay: [
		{ day: "2026-03-11", count: 2 },
		{ day: "2026-03-12", count: 4 },
	],
	classificationOptions: [
		{ id: 2, key: "idea", label: "Idea", answerCount: 1 },
		{ id: 1, key: "support", label: "Support", answerCount: 3 },
	],
	unclassifiedCount: 2,
};
