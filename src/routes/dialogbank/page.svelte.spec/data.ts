import type { PageData } from "../$types";

export const sampleDialogbankPageData = {
	user: null,
	guests: 3,
	answerCount: 4,
	classificationCounts: {
		proGelsenkirchen: 2,
		conGelsenkirchen: 1,
		ideaGelsenkirchen: 1,
	},
	quotes: [
		{
			id: 10,
			text: "Gelsenkirchen hält zusammen.",
			classification: "proGelsenkirchen",
			firstName: "Ada",
			lastName: "Lovelace",
			age: 28,
		},
		{
			id: 9,
			text: "Mehr Kultur im Zentrum.",
			classification: "ideaGelsenkirchen",
			firstName: "Linus",
			lastName: "Torvalds",
			age: 32,
		},
	],
} satisfies PageData;
