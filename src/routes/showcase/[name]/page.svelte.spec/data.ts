import type { PageData } from "../$types";

export const sampleShowcasePageData = {
	user: null,
	assignmentName: "Gelsenkirchen",
	guests: 3,
	answerCount: 4,
	topClassifications: [
		{ id: 1, key: "pro", label: "Pro Gelsenkirchen", emoji: "❤️", count: 2 },
		{ id: 2, key: "idee", label: "Idee für Gelsenkirchen", emoji: "💡", count: 1 },
		{ id: 3, key: "contra", label: "Problem in Gelsenkirchen", emoji: "😤", count: 1 },
	],
	quotes: [
		{
			id: 10,
			text: "Gelsenkirchen hält zusammen.",
			classificationId: 1,
			firstName: "Ada",
			lastName: "Lovelace",
			age: 28,
		},
		{
			id: 9,
			text: "Mehr Kultur im Zentrum.",
			classificationId: 2,
			firstName: "Linus",
			lastName: "Torvalds",
			age: 32,
		},
	],
} satisfies PageData;
