import type { DashboardConversationDay } from "../types";

export const sampleConversationDays = [
	{ day: "2026-03-11", count: 2 },
	{ day: "2026-03-14 00:00:00", count: 4 },
] satisfies DashboardConversationDay[];

export const emptyConversationDays = [] satisfies DashboardConversationDay[];
