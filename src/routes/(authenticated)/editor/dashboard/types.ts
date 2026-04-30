export type DashboardStatItem = {
	label: string;
	value: number;
};

export type DashboardConversationDay = {
	day: string;
	count: number;
};

export type DashboardClassificationSummary = {
	id: number;
	key: string;
	label: string;
	answerCount: number;
};

export type DashboardClassificationOption = {
	id: number;
	key: string;
	label: string;
};

export type DashboardAnswer = {
	id: number;
	value: string;
	rationale: string | null;
	classificationId: number | null;
	classification: string;
	name: string;
};

export type DashboardForm =
	| { answerId: number; message: string; success: boolean }
	| {
			classificationSuccess?: boolean;
			classificationMessage?: string;
			classificationWarning?: string;
			confirmDeleteId?: number;
	  }
	| null
	| undefined;
