import { and, isNotNull } from "drizzle-orm";
import { assignments } from "$lib/server/db/schema";
import { slugify } from "$lib/slugify";
import type { DbClient } from "./db";

export function makeAssignmentSlugBase(name: string): string {
	return slugify(name) || "einsatz";
}

export async function createUniqueAssignmentSlug(
	db: DbClient,
	name: string,
	excludeAssignmentId?: number,
): Promise<string> {
	const base = makeAssignmentSlugBase(name);
	const rows = await db.select({ id: assignments.id, slug: assignments.slug }).from(assignments);
	const usedSlugs = new Set(
		rows.filter((row) => row.id !== excludeAssignmentId).map((row) => row.slug),
	);

	if (!usedSlugs.has(base)) return base;

	let suffix = 2;
	while (usedSlugs.has(`${base}-${suffix}`)) {
		suffix++;
	}

	return `${base}-${suffix}`;
}

// An assignment is public once its agent has been configured successfully:
// right after connecting, or when configuring fails, the agent does not ask its
// questions yet. Disconnecting clears both columns.
export const isPublishedAssignment = and(
	isNotNull(assignments.elevenLabsAgentId),
	isNotNull(assignments.agentConfiguredAt),
);
