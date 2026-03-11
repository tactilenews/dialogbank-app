import { eq } from "drizzle-orm";
import { db } from "$lib/server/db";
import { answers, conversations } from "$lib/server/db/schema";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
	const publishedAnswers = await db
		.select({
			id: answers.id,
			value: answers.value,
		})
		.from(answers)
		.innerJoin(
			conversations,
			eq(answers.conversationId, conversations.conversationId),
		)
		.where(eq(conversations.publicationAllowed, true));

	return {
		user: event.locals.user,
		answers: publishedAnswers,
	};
};
