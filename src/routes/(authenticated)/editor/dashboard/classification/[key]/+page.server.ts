import { error, fail } from "@sveltejs/kit";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { withAuthenticatedActions, withAuthenticatedLoad } from "$lib/server/require-user";
import type { Actions, PageServerLoad } from "./$types";

const UNCLASSIFIED_KEY = "unclassified";

export const load = withAuthenticatedLoad<
	Parameters<PageServerLoad>[0],
	ReturnType<PageServerLoad>
>(async (event) => {
	const { db, schema } = event.locals;
	const { answers, classifications, conversations } = schema;
	const key = event.params.key;

	const isUnclassified = key === UNCLASSIFIED_KEY;

	let classificationRecord: { id: number; key: string; label: string } | null = null;
	if (!isUnclassified) {
		const [row] = await db
			.select({ id: classifications.id, key: classifications.key, label: classifications.label })
			.from(classifications)
			.where(eq(classifications.key, key))
			.limit(1);
		if (!row) throw error(404, "Klassifizierung nicht gefunden.");
		classificationRecord = row;
	}

	// When !isUnclassified, classificationRecord is guaranteed non-null (404 thrown above).
	// Use nullish coalescing so TypeScript is satisfied without a non-null assertion.
	const matchId = classificationRecord?.id ?? -1;
	const predicate = isUnclassified
		? isNull(answers.classificationId)
		: eq(answers.classificationId, matchId);

	const answerHasValuePredicate = sql`${answers.value} IS NOT NULL AND trim(${answers.value}) <> ''`;

	const classificationAnswers = await db
		.select({
			id: answers.id,
			value: answers.value,
			rationale: answers.rationale,
			classificationId: answers.classificationId,
			firstName: conversations.firstName,
			lastName: conversations.lastName,
		})
		.from(answers)
		.innerJoin(conversations, eq(answers.conversationId, conversations.conversationId))
		.where(and(predicate, answerHasValuePredicate))
		.orderBy(desc(answers.id));

	const allClassifications = await db
		.select({ id: classifications.id, key: classifications.key, label: classifications.label })
		.from(classifications)
		.orderBy(classifications.label);

	// classificationRecord is null iff isUnclassified — the ?? fallback is never reached for !isUnclassified
	const classification = classificationRecord ?? {
		key: UNCLASSIFIED_KEY,
		label: "Nicht klassifiziert",
	};

	return {
		classification,
		answers: classificationAnswers.map((a) => ({
			id: a.id,
			value: a.value ?? "",
			rationale: a.rationale,
			classificationId: a.classificationId,
			classification: classification.label,
			name: [a.firstName, a.lastName].filter(Boolean).join(" ") || "Unbekannt",
		})),
		classificationOptions: allClassifications,
	};
});

function parseRequiredInteger(value: FormDataEntryValue | null) {
	if (typeof value !== "string" || value.trim() === "") return null;
	const parsed = Number(value);
	return Number.isInteger(parsed) && Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export const actions = withAuthenticatedActions<Parameters<Actions["classifyAnswer"]>[0], Actions>({
	classifyAnswer: async (event) => {
		const { db, schema } = event.locals;
		const { answers, classifications } = schema;
		const formData = await event.request.formData();

		const answerId = parseRequiredInteger(formData.get("answerId"));
		if (answerId === null) return fail(400, { message: "Eine gültige Antwort ist erforderlich." });

		const requestedClassificationId = formData.get("classificationId");
		const classificationId =
			typeof requestedClassificationId === "string" && requestedClassificationId.trim() !== ""
				? parseRequiredInteger(requestedClassificationId)
				: null;

		const [answerRecord] = await db
			.select({ id: answers.id })
			.from(answers)
			.where(eq(answers.id, answerId))
			.limit(1);
		if (!answerRecord) return fail(404, { answerId, message: "Antwort nicht gefunden." });

		let classificationLabel: string | null = null;
		if (classificationId !== null) {
			const [classificationRecord] = await db
				.select({ id: classifications.id, label: classifications.label })
				.from(classifications)
				.where(eq(classifications.id, classificationId))
				.limit(1);
			if (!classificationRecord)
				return fail(400, { answerId, message: "Klassifizierung nicht gefunden." });
			classificationLabel = classificationRecord.label;
		}

		await db.update(answers).set({ classificationId }).where(eq(answers.id, answerId));

		return {
			answerId,
			message:
				classificationLabel === null
					? "Antwort wurde als nicht klassifiziert markiert."
					: `Antwort wurde ${classificationLabel} zugeordnet.`,
			success: true,
		};
	},
});
