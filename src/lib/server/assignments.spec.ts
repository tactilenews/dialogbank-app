import { eq } from "drizzle-orm";
import { describe, it } from "$lib/server/test/fixtures";
import { backfillLegacyAssignmentAgent } from "./assignments";

describe("backfillLegacyAssignmentAgent", () => {
	it("transfers the published assignment to the configured legacy agent", async ({
		db,
		expect,
		schema,
	}) => {
		await db
			.update(schema.assignments)
			.set({ isPublished: true })
			.where(eq(schema.assignments.id, 1));

		await expect(
			backfillLegacyAssignmentAgent(db, { ELEVENLABS_AGENT_ID: "agent_legacy" }),
		).resolves.toBeUndefined();

		const assignment = await db.query.assignments.findFirst({
			where: (row, { eq }) => eq(row.id, 1),
		});
		expect(assignment).toMatchObject({
			elevenLabsAgentId: "agent_legacy",
			isPublished: false,
		});
	});
});
