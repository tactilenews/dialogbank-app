import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { PageServerLoad } from "./$types";

const PAGE_SIZE = 20;
const SUCCESS_STATUS = "success";
const UNCLASSIFIED_GROUP = {
	key: "unclassified",
	label: "Unclassified",
} as const;

function parsePageParam(value: string | null) {
	if (value === null) {
		return 1;
	}

	const page = Number(value);
	return Number.isInteger(page) && Number.isFinite(page) && page > 0 ? page : 1;
}

export const load: PageServerLoad = async (event) => {
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
				value: answer.value ?? "",
				name: [answer.firstName, answer.lastName].filter(Boolean).join(" ") || "Unknown",
			})),
			pagination: {
				page: currentPage,
				pageSize: PAGE_SIZE,
				total,
				totalPages,
			},
		};
	};

	const classificationRows = await db
		.selectDistinct({
			id: classifications.id,
			key: classifications.key,
			label: classifications.label,
		})
		.from(answers)
		.innerJoin(classifications, eq(answers.classificationId, classifications.id))
		.where(answerHasValuePredicate)
		.orderBy(classifications.label, classifications.key);

	const classifiedGroups = await Promise.all(
		classificationRows.map(({ id, key, label }) =>
			buildClassificationGroup({
				key,
				label,
				predicate: eq(answers.classificationId, id),
			}),
		),
	);

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
	};
};
