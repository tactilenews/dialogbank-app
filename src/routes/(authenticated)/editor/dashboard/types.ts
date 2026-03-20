import type { ActionData, PageData } from "./$types";

export type DashboardStatItem = {
	label: string;
	value: number;
};

export type DashboardConversationDay = PageData["conversationsPerDay"][number];
export type DashboardClassificationOption = PageData["classificationOptions"][number];
export type DashboardClassificationGroup = PageData["classificationGroups"][number];
export type DashboardAnswer = DashboardClassificationGroup["answers"][number];
export type DashboardForm = ActionData | undefined;
