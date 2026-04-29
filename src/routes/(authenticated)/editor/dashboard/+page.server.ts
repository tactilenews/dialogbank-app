import { fail } from "@sveltejs/kit";
import { count, eq, isNull, sql } from "drizzle-orm";
import { withAuthenticatedActions, withAuthenticatedLoad } from "$lib/server/require-user";
import { slugify } from "$lib/slugify";
import type { Actions, PageServerLoad } from "./$types";

const SUCCESS_STATUS = "success";
const UNCLASSIFIED_KEY = "unclassified";

export const load = withAuthenticatedLoad<
	Parameters<PageServerLoad>[0],
	ReturnType<PageServerLoad>
>(async (event) => {
	const { db, schema } = event.locals;
	const { answers, classifications, conversations } = schema;

	const successfulConversationsResult = await db
		.select({ count: sql<number>`count(*)` })
		.from(conversations)
		.where(eq(conversations.callSuccessful, SUCCESS_STATUS));
	const successfulConversations = Number(successfulConversationsResult[0]?.count ?? 0);

	const totalAnswersResult = await db.select({ count: sql<number>`count(*)` }).from(answers);
	const totalAnswers = Number(totalAnswersResult[0]?.count ?? 0);

	const dayExpression = sql<Date>`date_trunc('day', ${conversations.createdAt})`;
	const conversationsPerDay = await db
		.select({
			day: dayExpression.as("day"),
			count: sql<number>`count(*)`.as("count"),
		})
		.from(conversations)
		.groupBy(dayExpression)
		.orderBy(dayExpression);

	const classificationRows = await db
		.select({
			id: classifications.id,
			key: classifications.key,
			label: classifications.label,
			answerCount: count(answers.id),
		})
		.from(classifications)
		.leftJoin(answers, eq(answers.classificationId, classifications.id))
		.groupBy(classifications.id, classifications.key, classifications.label)
		.orderBy(classifications.label, classifications.key);

	const classificationOptions = classificationRows.map((c) => ({
		id: c.id,
		key: c.key,
		label: c.label,
		answerCount: Number(c.answerCount),
	}));

	const unclassifiedResult = await db
		.select({ count: sql<number>`count(*)` })
		.from(answers)
		.where(isNull(answers.classificationId));
	const unclassifiedCount = Number(unclassifiedResult[0]?.count ?? 0);

	return {
		successfulConversations,
		totalAnswers,
		conversationsPerDay: conversationsPerDay.map((row) => ({
			day: row.day instanceof Date ? row.day.toISOString().slice(0, 10) : String(row.day),
			count: Number(row.count ?? 0),
		})),
		classificationOptions,
		unclassifiedCount,
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

	createClassification: async (event) => {
		const { db, schema } = event.locals;
		const formData = await event.request.formData();
		const label = (formData.get("label") as string | null)?.trim();
		if (!label) return fail(400, { classificationMessage: "Bezeichnung ist erforderlich." });
		const key = slugify(label);
		try {
			await db.insert(schema.classifications).values({ key, label });
		} catch {
			return fail(409, {
				classificationMessage: `Klassifizierung mit Key "${key}" existiert bereits.`,
			});
		}
		return { classificationSuccess: true, classificationMessage: "Klassifizierung angelegt." };
	},

	updateClassification: async (event) => {
		const { db, schema } = event.locals;
		const formData = await event.request.formData();
		const id = Number(formData.get("id"));
		if (!Number.isInteger(id) || id <= 0)
			return fail(400, { classificationMessage: "Ungültige ID." });
		const label = (formData.get("label") as string | null)?.trim();
		if (!label) return fail(400, { classificationMessage: "Bezeichnung ist erforderlich." });
		const [updated] = await db
			.update(schema.classifications)
			.set({ label })
			.where(eq(schema.classifications.id, id))
			.returning();
		if (!updated) return fail(404, { classificationMessage: "Klassifizierung nicht gefunden." });
		return { classificationSuccess: true, classificationMessage: "Klassifizierung aktualisiert." };
	},

	deleteClassification: async (event) => {
		const { db, schema } = event.locals;
		const formData = await event.request.formData();
		const id = Number(formData.get("id"));
		if (!Number.isInteger(id) || id <= 0)
			return fail(400, { classificationMessage: "Ungültige ID." });
		const confirmed = formData.get("confirmed") === "true";

		if (!confirmed) {
			const [countResult] = await db
				.select({ count: count(schema.answers.id) })
				.from(schema.answers)
				.where(eq(schema.answers.classificationId, id));
			const answerCount = Number(countResult?.count ?? 0);
			if (answerCount > 0) {
				return fail(409, {
					classificationWarning: `Diese Klassifizierung enthält ${answerCount} Antwort${answerCount === 1 ? "" : "en"}. Beim Löschen werden diese als "${UNCLASSIFIED_KEY === "unclassified" ? "Nicht klassifiziert" : UNCLASSIFIED_KEY}" markiert.`,
					confirmDeleteId: id,
				});
			}
		}

		await db.delete(schema.classifications).where(eq(schema.classifications.id, id));
		return { classificationSuccess: true, classificationMessage: "Klassifizierung gelöscht." };
	},
});
