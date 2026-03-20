import type { DashboardClassificationGroup, DashboardClassificationOption } from "../types";

export const sampleClassificationOptions = [
	{ id: 2, key: "idea", label: "Idea" },
	{ id: 1, key: "support", label: "Support" },
] satisfies DashboardClassificationOption[];

export const sampleClassificationGroup = {
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
	],
	pagination: {
		page: 1,
		pageSize: 20,
		total: 4,
		totalPages: 2,
	},
} satisfies DashboardClassificationGroup;
