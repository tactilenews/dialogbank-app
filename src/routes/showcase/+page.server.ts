import { asc, eq } from "drizzle-orm";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
	const { db, schema } = event.locals;
	const { assignments } = schema;

	const publishedAssignments = await db
		.select({ name: assignments.name, slug: assignments.slug, location: assignments.location })
		.from(assignments)
		.where(eq(assignments.isPublished, true))
		.orderBy(asc(assignments.name));

	return { publishedAssignments };
};
