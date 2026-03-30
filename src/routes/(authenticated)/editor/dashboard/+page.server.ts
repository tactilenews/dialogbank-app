import { fail } from "@sveltejs/kit";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { withAuthenticatedActions, withAuthenticatedLoad } from "$lib/server/require-user";
import type { Actions, PageServerLoad } from "./$types";

const PAGE_SIZE = 20;
const SUCCESS_STATUS = "success";
const UNCLASSIFIED_GROUP = {
	key: "unclassified",
	label: "Nicht klassifiziert",
} as const;

function parsePageParam(value: string | null) {
	if (value === null) {
		return 1;
	}

	const page = Number(value);
	return Number.isInteger(page) && Number.isFinite(page) && page > 0 ? page : 1;
}

function parseRequiredInteger(value: FormDataEntryValue | null) {
	if (typeof value !== "string" || value.trim() === "") {
		return null;
	}

	const parsed = Number(value);
	return Number.isInteger(parsed) && Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseOptionalInteger(value: FormDataEntryValue | null) {
	if (value === null) {
		return null;
	}

	if (typeof value !== "string") {
		return null;
	}

	const trimmed = value.trim();
	if (trimmed === "") {
		return null;
	}

	const parsed = Number(trimmed);
	return Number.isInteger(parsed) && Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

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

	const answerHasValuePredicate = sql`${answers.value} IS NOT NULL AND trim(${answers.value}) <> ''`;

	const classificationRows = await db
		.select({
			id: classifications.id,
			key: classifications.key,
			label: classifications.label,
		})
		.from(classifications)
		.orderBy(classifications.label, classifications.key);

	const classificationOptions = classificationRows.map((classification) => ({
		id: classification.id,
		key: classification.key,
		label: classification.label,
	}));

	const buildClassificationGroup = async ({
		key,
		label,
		predicate,
	}: {
		key: string;
		label: string;
		predicate: ReturnType<typeof eq> | ReturnType<typeof isNull>;
	}) => {
		const totalResult = await db
			.select({ count: sql<number>`count(*)` })
			.from(answers)
			.where(and(predicate, answerHasValuePredicate));
		const total = Number(totalResult[0]?.count ?? 0);
		const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
		const currentPage = Math.min(
			parsePageParam(event.url.searchParams.get(`page_${key}`)),
			totalPages,
		);
		const offset = (currentPage - 1) * PAGE_SIZE;

		const pagedAnswers = await db
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
			.orderBy(desc(answers.id))
			.limit(PAGE_SIZE)
			.offset(offset);

		return {
			classification: label,
			key,
			answers: pagedAnswers.map((answer) => ({
				id: answer.id,
				classification: label,
				classificationId: answer.classificationId,
				rationale: answer.rationale,
				value: answer.value ?? "",
				name: [answer.firstName, answer.lastName].filter(Boolean).join(" ") || "Unbekannt",
			})),
			pagination: {
				page: currentPage,
				pageSize: PAGE_SIZE,
				total,
				totalPages,
			},
		};
	};

	const classifiedGroups = (
		await Promise.all(
			classificationRows.map(({ id, key, label }) =>
				buildClassificationGroup({
					key,
					label,
					predicate: eq(answers.classificationId, id),
				}),
			),
		)
	).filter((group) => group.pagination.total > 0);

	const unclassifiedGroup = await buildClassificationGroup({
		key: UNCLASSIFIED_GROUP.key,
		label: UNCLASSIFIED_GROUP.label,
		predicate: isNull(answers.classificationId),
	});

	const classificationGroups =
		unclassifiedGroup.pagination.total > 0
			? [...classifiedGroups, unclassifiedGroup]
			: classifiedGroups;

	return {
		successfulConversations,
		totalAnswers,
		conversationsPerDay: conversationsPerDay.map((row) => ({
			day: row.day instanceof Date ? row.day.toISOString().slice(0, 10) : String(row.day),
			count: Number(row.count ?? 0),
		})),
		classificationGroups,
		classificationOptions,
	};
});

export const actions = withAuthenticatedActions<Parameters<Actions["default"]>[0], Actions>({
	default: async (event) => {
		const { db, schema } = event.locals;
		const { answers, classifications } = schema;
		const formData = await event.request.formData();

		const answerId = parseRequiredInteger(formData.get("answerId"));
		if (answerId === null) {
			return fail(400, {
				message: "Eine gültige Antwort ist erforderlich.",
			});
		}

		const requestedClassificationId = formData.get("classificationId");
		const classificationId = parseOptionalInteger(requestedClassificationId);
		if (
			requestedClassificationId !== null &&
			typeof requestedClassificationId === "string" &&
			requestedClassificationId.trim() !== "" &&
			classificationId === null
		) {
			return fail(400, {
				answerId,
				message: "Eine gültige Klassifizierung ist erforderlich.",
			});
		}

		const [answerRecord] = await db
			.select({ id: answers.id })
			.from(answers)
			.where(eq(answers.id, answerId))
			.limit(1);

		if (!answerRecord) {
			return fail(404, {
				answerId,
				message: "Antwort nicht gefunden.",
			});
		}

		let classificationLabel: string | null = null;
		if (classificationId !== null) {
			const [classificationRecord] = await db
				.select({
					id: classifications.id,
					label: classifications.label,
				})
				.from(classifications)
				.where(eq(classifications.id, classificationId))
				.limit(1);

			if (!classificationRecord) {
				return fail(400, {
					answerId,
					message: "Klassifizierung nicht gefunden.",
				});
			}

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
