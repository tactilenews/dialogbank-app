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
		{ id: 2, key: "idea", label: "Idea" },
		{ id: 1, key: "support", label: "Support" },
	],
	classificationGroups: [
		{
			classification: "Support",
			key: "support",
			answers: [
				{
					id: 101,
					classification: "Support",
					classificationId: 1,
					rationale: "The answer explicitly asks for more green spaces in the city.",
					value: "Gelsenkirchen needs more green spaces.",
					name: "Mara Klein",
				},
				{
					id: 100,
					classification: "Support",
					classificationId: 1,
					rationale: "The speaker proposes expanding community centers as local support.",
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
					classificationId: 2,
					rationale: "This is a concrete civic idea for a recurring neighborhood event.",
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
					classificationId: null,
					rationale:
						"The source answer is ambiguous and needs editor review before classification.",
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

export const sampleEditorPageDataAfterManualClassification: PageData = {
	...sampleEditorPageData,
	classificationGroups: [
		{
			classification: "Support",
			key: "support",
			answers: [
				{
					id: 101,
					classification: "Support",
					classificationId: 1,
					rationale: "The answer explicitly asks for more green spaces in the city.",
					value: "Gelsenkirchen needs more green spaces.",
					name: "Mara Klein",
				},
				{
					id: 100,
					classification: "Support",
					classificationId: 1,
					rationale: "The speaker proposes expanding community centers as local support.",
					value: "We should expand community centers.",
					name: "Jonas Becker",
				},
				{
					id: 98,
					classification: "Support",
					classificationId: 1,
					rationale:
						"The source answer is ambiguous and needs editor review before classification.",
					value: "Needs review before it can be categorized.",
					name: "Mara Klein",
				},
			],
			pagination: {
				page: 1,
				pageSize: 20,
				total: 5,
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
					classificationId: 2,
					rationale: "This is a concrete civic idea for a recurring neighborhood event.",
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
	],
};
