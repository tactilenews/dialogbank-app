import { and, asc, eq, gt, isNotNull } from "drizzle-orm";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
	const { db, schema } = event.locals;
	const { assignments } = schema;

	const availableAssignments = await db
		.select({ name: assignments.name, slug: assignments.slug, location: assignments.location })
		.from(assignments)
		.where(
			and(
				isNotNull(assignments.elevenLabsAgentId),
				gt(assignments.appliedAgentConfigurationRevision, 0),
				eq(assignments.agentConfigurationRevision, assignments.appliedAgentConfigurationRevision),
			),
		)
		.orderBy(asc(assignments.name));

	return {
		availableAssignments,
	};
};
