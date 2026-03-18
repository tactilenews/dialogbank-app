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
	classificationGroups: [
		{
			classification: "Support",
			key: "support",
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
			],
			pagination: {
				page: 1,
				pageSize: 20,
				total: 4,
				totalPages: 2,
			},
		},
		{
			classification: "Idea",
			key: "idea",
			answers: [
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
				total: 2,
				totalPages: 2,
			},
		},
		{
			classification: "Unclassified",
			key: "unclassified",
			answers: [
				{
					id: 98,
					classification: "Unclassified",
					value: "Needs review before it can be categorized.",
					name: "Mara Klein",
				},
			],
			pagination: {
				page: 1,
				pageSize: 20,
				total: 1,
				totalPages: 1,
			},
		},
	],
};
