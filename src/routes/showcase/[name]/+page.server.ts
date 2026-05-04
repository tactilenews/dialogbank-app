import { error } from "@sveltejs/kit";
import { and, desc, eq, sql } from "drizzle-orm";
import { hasVisibleQuoteText } from "../quotes";
import type { PageServerLoad } from "./$types";

const MAX_DISPLAYED_CLASSIFICATIONS = 3;

export const load: PageServerLoad = async (event) => {
	const { db, schema } = event.locals;
	const { answers, classifications, conversations, assignments } = schema;
	const slug = event.params.name;

	const [assignment] = await db
		.select({ id: assignments.id, name: assignments.name })
		.from(assignments)
		.where(eq(assignments.slug, slug))
		.limit(1);
	if (!assignment) error(404, "Einsatz nicht gefunden.");

	const [conversationCountRow] = await db
		.select({ count: sql<number>`count(*)` })
		.from(conversations)
		.where(eq(conversations.assignmentId, assignment.id));
	const guests = Number(conversationCountRow?.count ?? 0);

	const publishedAnswers = await db
		.select({
			id: answers.id,
			value: answers.value,
			classificationId: answers.classificationId,
			classificationKey: classifications.key,
			classificationLabel: classifications.label,
			classificationEmoji: classifications.emoji,
			firstName: conversations.firstName,
			lastName: conversations.lastName,
			age: conversations.age,
		})
		.from(answers)
		.innerJoin(conversations, eq(answers.conversationId, conversations.conversationId))
		.leftJoin(classifications, eq(answers.classificationId, classifications.id))
		.where(
			and(
				eq(conversations.publicationAllowed, true),
				eq(conversations.assignmentId, assignment.id),
			),
		)
		.orderBy(desc(answers.id));

	const visibleAnswers = publishedAnswers.flatMap((answer) =>
		hasVisibleQuoteText(answer.value) ? [{ ...answer, value: answer.value.trim() }] : [],
	);

	const classificationCountMap = new Map<
		number,
		{ key: string; label: string; emoji: string | null; count: number }
	>();
	for (const answer of visibleAnswers) {
		if (answer.classificationId) {
			const existing = classificationCountMap.get(answer.classificationId);
			if (existing) {
				existing.count++;
			} else {
				classificationCountMap.set(answer.classificationId, {
					key: answer.classificationKey ?? "",
					label: answer.classificationLabel ?? "",
					emoji: answer.classificationEmoji ?? null,
					count: 1,
				});
			}
		}
	}

	const topClassifications = [...classificationCountMap.entries()]
		.sort(([, a], [, b]) => b.count - a.count)
		.slice(0, MAX_DISPLAYED_CLASSIFICATIONS)
		.map(([id, c]) => ({ id, ...c }));

	return {
		assignmentName: assignment.name,
		guests,
		answerCount: visibleAnswers.length,
		topClassifications,
		quotes: visibleAnswers.map((answer) => ({
			id: answer.id,
			text: answer.value,
			classificationId: answer.classificationId,
			firstName: answer.firstName,
			lastName: answer.lastName,
			age: answer.age,
		})),
	};
};
