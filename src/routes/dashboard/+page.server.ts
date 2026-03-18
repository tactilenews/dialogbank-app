import { desc, eq, sql } from "drizzle-orm";
import type { PageServerLoad } from "./$types";

const classificationValues = ["proGelsenkirchen", "conGelsenkirchen", "ideaGelsenkirchen"] as const;

export type LegacyClassification = (typeof classificationValues)[number];

const emptyClassificationCounts: Record<LegacyClassification, number> = {
	proGelsenkirchen: 0,
	conGelsenkirchen: 0,
	ideaGelsenkirchen: 0,
};

export const load: PageServerLoad = async (event) => {
	const { db, schema } = event.locals;
	const { answers, classifications, conversations } = schema;

	const conversationCountResult = await db
		.select({ count: sql<number>`count(*)` })
		.from(conversations);
	const guests = Number(conversationCountResult[0]?.count ?? 0);

	const publishedAnswers = await db
		.select({
			id: answers.id,
			value: answers.value,
			classification: classifications.key,
			firstName: conversations.firstName,
			lastName: conversations.lastName,
			age: conversations.age,
		})
		.from(answers)
		.innerJoin(conversations, eq(answers.conversationId, conversations.conversationId))
		.leftJoin(classifications, eq(answers.classificationId, classifications.id))
		.where(eq(conversations.publicationAllowed, true))
		.orderBy(desc(answers.id));

	const classificationCounts = { ...emptyClassificationCounts };
	for (const answer of publishedAnswers) {
		const classification = answer.classification;
		if (classification && classification in classificationCounts) {
			classificationCounts[classification as LegacyClassification] += 1;
		}
	}

	return {
		guests,
		answerCount: publishedAnswers.length,
		classificationCounts,
		quotes: publishedAnswers.map((answer) => ({
			id: answer.id,
			text: answer.value ?? "",
			classification: answer.classification,
			firstName: answer.firstName,
			lastName: answer.lastName,
			age: answer.age,
		})),
	};
};
