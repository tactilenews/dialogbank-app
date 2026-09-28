import { asc } from "drizzle-orm";
import { isPublishedAssignment } from "$lib/server/assignments";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
	const { db, schema } = event.locals;
	const { assignments } = schema;

	const availableAssignments = await db
		.select({ name: assignments.name, slug: assignments.slug, location: assignments.location })
		.from(assignments)
		.where(isPublishedAssignment)
		.orderBy(asc(assignments.name));

	return { availableAssignments };
};
