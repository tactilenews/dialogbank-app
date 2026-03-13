import { eq } from "drizzle-orm";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
	const { db, schema } = event.locals;
	const { answers, conversations } = schema;

	const publishedAnswers = await db
		.select({
			id: answers.id,
			value: answers.value,
		})
		.from(answers)
		.innerJoin(conversations, eq(answers.conversationId, conversations.conversationId))
		.where(eq(conversations.publicationAllowed, true));

	return {
		user: event.locals.user,
		answers: publishedAnswers,
	};
};
