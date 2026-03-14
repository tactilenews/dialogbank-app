import { desc, eq, sql } from "drizzle-orm";
import type { PageServerLoad } from "./$types";

const PAGE_SIZE = 20;
const SUCCESS_STATUS = "success";

export const load: PageServerLoad = async (event) => {
	const { db, schema } = event.locals;
	const { answers, conversations } = schema;

	const pageParam = event.url.searchParams.get("page");
	const currentPage = Math.max(1, Number(pageParam ?? "1") || 1);
	const offset = (currentPage - 1) * PAGE_SIZE;

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
		.orderBy(desc(answers.id))
		.limit(PAGE_SIZE)
		.offset(offset);

	return {
		successfulConversations,
		totalAnswers,
		conversationsPerDay: conversationsPerDay.map((row) => ({
			day: row.day instanceof Date ? row.day.toISOString().slice(0, 10) : String(row.day),
			count: Number(row.count ?? 0),
		})),
		answers: pagedAnswers.map((answer) => ({
			id: answer.id,
			classification: answer.classification ?? "Unclassified",
			value: answer.value ?? "",
			name: [answer.firstName, answer.lastName].filter(Boolean).join(" ") || "Unknown",
		})),
		pagination: {
			page: currentPage,
			pageSize: PAGE_SIZE,
			total: totalAnswers,
			totalPages: Math.max(1, Math.ceil(totalAnswers / PAGE_SIZE)),
		},
	};
};
