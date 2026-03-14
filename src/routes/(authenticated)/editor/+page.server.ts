import { desc, eq, sql } from "drizzle-orm";
import type { PageServerLoad } from "./$types";

const PAGE_SIZE = 20;
const SUCCESS_STATUS = "success";

function slugify(value: string) {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/(^-|-$)+/g, "");
}

export const load: PageServerLoad = async (event) => {
	const { db, schema } = event.locals;
	const { answers, conversations } = schema;

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
		.selectDistinct({ classification: answers.classification })
		.from(answers)
		.where(sql`${answers.value} IS NOT NULL AND trim(${answers.value}) <> ''`)
		.orderBy(answers.classification);

	const classificationValues = classificationRows
		.map((row) => ({
			classification: row.classification ?? "Unclassified",
			isNull: row.classification === null,
		}))
		.filter((row) => row.classification.length > 0);

	const classificationGroups = await Promise.all(
		classificationValues.map(async ({ classification, isNull }) => {
			const slug = slugify(classification);
			const pageParam = event.url.searchParams.get(`page_${slug}`);
			const currentPage = Math.max(1, Number(pageParam ?? "1") || 1);
			const offset = (currentPage - 1) * PAGE_SIZE;

			const classificationPredicate = isNull
				? sql`${answers.classification} IS NULL`
				: sql`${answers.classification} = ${classification}`;

			const totalResult = await db
				.select({ count: sql<number>`count(*)` })
				.from(answers)
				.where(
					sql`${classificationPredicate} AND ${answers.value} IS NOT NULL AND trim(${answers.value}) <> ''`,
				);
			const total = Number(totalResult[0]?.count ?? 0);

			const pagedAnswers = await db
				.select({
					id: answers.id,
					classification: answers.classification,
					value: answers.value,
					firstName: conversations.firstName,
					lastName: conversations.lastName,
				})
				.from(answers)
				.innerJoin(conversations, eq(answers.conversationId, conversations.conversationId))
				.where(
					sql`${classificationPredicate} AND ${answers.value} IS NOT NULL AND trim(${answers.value}) <> ''`,
				)
				.orderBy(desc(answers.id))
				.limit(PAGE_SIZE)
				.offset(offset);

			return {
				classification,
				slug,
				answers: pagedAnswers.map((answer) => ({
					id: answer.id,
					classification: answer.classification ?? "Unclassified",
					value: answer.value ?? "",
					name: [answer.firstName, answer.lastName].filter(Boolean).join(" ") || "Unknown",
				})),
				pagination: {
					page: currentPage,
					pageSize: PAGE_SIZE,
					total,
					totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
				},
			};
		}),
	);

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
