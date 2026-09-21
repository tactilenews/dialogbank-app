import { and, eq, isNull } from "drizzle-orm";
import { assignments } from "$lib/server/db/schema";
import { slugify } from "$lib/slugify";
import type { DbClient } from "./db";

export async function backfillLegacyAssignmentAgent(
	db: DbClient,
	environment: { ELEVENLABS_AGENT_ID?: string },
): Promise<void> {
	const legacyAgentId = environment.ELEVENLABS_AGENT_ID?.trim();
	if (!legacyAgentId) return;

	await db
		.update(assignments)
		.set({ elevenLabsAgentId: legacyAgentId, isPublished: false })
		.where(and(eq(assignments.isPublished, true), isNull(assignments.elevenLabsAgentId)));
}

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
