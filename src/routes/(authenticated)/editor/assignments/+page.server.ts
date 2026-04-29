import { fail, redirect } from "@sveltejs/kit";
import { count, eq } from "drizzle-orm";
import { assignments, questions } from "$lib/server/db/schema";
import { withAuthenticatedActions, withAuthenticatedLoad } from "$lib/server/require-user";
import type { Actions, PageServerLoad } from "./$types";

export const load = withAuthenticatedLoad<
	Parameters<PageServerLoad>[0],
	ReturnType<PageServerLoad>
>(async ({ locals }) => {
	const rows = await locals.db
		.select({
			id: assignments.id,
			name: assignments.name,
			location: assignments.location,
			client: assignments.client,
			isActive: assignments.isActive,
			createdAt: assignments.createdAt,
			questionCount: count(questions.id),
		})
		.from(assignments)
		.leftJoin(questions, eq(questions.assignmentId, assignments.id))
		.groupBy(assignments.id)
		.orderBy(assignments.createdAt);

	return { assignments: rows };
});

export const actions = withAuthenticatedActions<Parameters<Actions["default"]>[0], Actions>({
	default: async (event) => {
		const formData = await event.request.formData();
		const name = (formData.get("name") as string | null)?.trim();

		if (!name) {
			return fail(400, { message: "Name ist erforderlich." });
		}

		const [created] = await event.locals.db.insert(assignments).values({ name }).returning();

		redirect(303, `/editor/assignments/${created.id}`);
	},
});
