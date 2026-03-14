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
	answers: [
		{
			id: 101,
			classification: "Support",
			value: "Gelsenkirchen needs more green spaces.",
			name: "Mara Klein",
		},
		{
			id: 100,
			classification: "Support",
			value: "We should expand community centers.",
			name: "Jonas Becker",
		},
		{
			id: 99,
			classification: "Idea",
			value: "Start a weekly neighborhood market.",
			name: "Sana Idris",
		},
	],
	pagination: {
		page: 1,
		pageSize: 20,
		total: 6,
		totalPages: 2,
	},
};
