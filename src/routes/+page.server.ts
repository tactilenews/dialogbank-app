import { eq } from "drizzle-orm";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
	const { db, schema } = event.locals;
	const { assignments } = schema;

	const activeRows = await db
		.select({ slug: assignments.slug })
		.from(assignments)
		.where(eq(assignments.isActive, true))
		.limit(1);
	const active = activeRows.at(0);

	return {
		showcaseSlug: active?.slug ?? null,
	};
};
