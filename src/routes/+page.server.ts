import { asc, isNotNull } from "drizzle-orm";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
	const { db, schema } = event.locals;
	const { assignments } = schema;

	const availableAssignments = await db
		.select({ name: assignments.name, slug: assignments.slug, location: assignments.location })
		.from(assignments)
		.where(isNotNull(assignments.elevenLabsAgentId))
		.orderBy(asc(assignments.name));

	return {
		availableAssignments,
	};
};
