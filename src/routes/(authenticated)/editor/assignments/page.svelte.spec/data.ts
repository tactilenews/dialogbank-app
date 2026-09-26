import type { PageData } from "../$types";

export const assignmentListPageData: PageData = {
	user: {
		id: "user-1",
		name: "Editor",
		email: "editor@example.com",
	},
	assignments: [
		{
			id: 1,
			name: "Innenstadt",
			slug: "innenstadt",
			location: "Gelsenkirchen",
			client: "Lokalredaktion",
			elevenLabsAgentId: "agent_current",
			createdAt: new Date("2026-09-20T00:00:00.000Z"),
			questionCount: 2,
		},
		{
			id: 2,
			name: "Bahnhof",
			slug: "bahnhof",
			location: null,
			client: null,
			elevenLabsAgentId: null,
			createdAt: new Date("2026-09-21T00:00:00.000Z"),
			questionCount: 1,
		},
	],
};
