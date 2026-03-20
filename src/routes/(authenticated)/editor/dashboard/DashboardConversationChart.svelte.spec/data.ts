import type { DashboardConversationDay } from "../types";

export const sampleConversationDays = [
	{ day: "2026-03-11", count: 2 },
	{ day: "2026-03-12", count: 4 },
] satisfies DashboardConversationDay[];

export const emptyConversationDays = [] satisfies DashboardConversationDay[];
