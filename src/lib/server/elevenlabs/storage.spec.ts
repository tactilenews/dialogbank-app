import { describe, it } from "$lib/server/test/fixtures";
import { processElevenLabsPostCall } from "./storage";
import { samplePayload1, samplePayload2 } from "./storage.spec/data";

describe("ElevenLabs Storage", () => {
	it("processes payload with no results", async ({ db, expect, schema }) => {
		const resultPromise = processElevenLabsPostCall({ db, payload: samplePayload1 });
		await expect(resultPromise).resolves.toEqual(
			expect.objectContaining({
				answerCount: 0,
			}),
		);

		const conversationsPromise = db.select().from(schema.conversations);
		await expect(conversationsPromise).resolves.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					conversationId: samplePayload1.data.conversation_id,
					publicationAllowed: null,
				}),
			]),
		);

		const answersPromise = db.select().from(schema.answers);
		await expect(answersPromise).resolves.toHaveLength(0);
	});

	it("processes latest payload format (English IDs)", async ({ db, expect, schema }) => {
		const resultPromise = processElevenLabsPostCall({ db, payload: samplePayload2 });
		await expect(resultPromise).resolves.toEqual(
			expect.objectContaining({
				answerCount: 1,
			}),
		);

		const conversationsPromise = db.select().from(schema.conversations);
		await expect(conversationsPromise).resolves.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					agentId: samplePayload2.data.agent_id,
					conversationId: samplePayload2.data.conversation_id,
					firstName: "Fritz",
					lastName: "Haarmaan",
					age: 49,
					publicationAllowed: true,
					callSuccessful: "success",
					summary: expect.stringContaining("The conversation began"),
				}),
			]),
		);

		const answersPromise = db.select().from(schema.answers);
		await expect(answersPromise).resolves.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					conversationId: samplePayload2.data.conversation_id,
					dataCollectionId: "answer_1",
					value: "Sachsen",
				}),
			]),
		);
	});
});
