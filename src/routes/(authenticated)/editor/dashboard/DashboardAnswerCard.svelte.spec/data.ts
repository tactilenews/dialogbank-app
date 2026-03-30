import type { DashboardAnswer, DashboardClassificationOption, DashboardForm } from "../types";

export const sampleClassificationOptions = [
	{ id: 2, key: "idea", label: "Idea" },
	{ id: 1, key: "support", label: "Support" },
] satisfies DashboardClassificationOption[];

export const sampleAnswer = {
	id: 98,
	classification: "Nicht klassifiziert",
	classificationId: null,
	rationale: "The source answer is ambiguous and needs editor review before classification.",
	value: "Needs review before it can be categorized.",
	name: "Mara Klein",
} satisfies DashboardAnswer;

export const successForm = {
	answerId: 98,
	message: "Antwort wurde als nicht klassifiziert markiert.",
	success: true,
} satisfies Exclude<DashboardForm, undefined>;
