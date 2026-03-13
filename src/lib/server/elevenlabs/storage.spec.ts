import { beforeEach, describe, expect, it } from "vitest";
import { db } from "$lib/server/db";
import { answers, conversations } from "$lib/server/db/schema";
import { processElevenLabsPostCall } from "./storage";
import { samplePayload1, samplePayload2 } from "./storage.spec/data";

describe("ElevenLabs Storage", () => {
	beforeEach(async () => {
		await expect(db.delete(answers)).resolves.toBeDefined();
		await expect(db.delete(conversations)).resolves.toBeDefined();
	});

	it("processes payload with no results", async () => {
		const resultPromise = processElevenLabsPostCall(samplePayload1);
		await expect(resultPromise).resolves.toEqual(
			expect.objectContaining({
				answerCount: 0,
			}),
		);

		const conversationsPromise = db.select().from(conversations);
		await expect(conversationsPromise).resolves.toHaveLength(1);

		const answersPromise = db.select().from(answers);
		await expect(answersPromise).resolves.toHaveLength(0);
	});

	it("processes latest payload format (English IDs)", async () => {
		const resultPromise = processElevenLabsPostCall(samplePayload2);
		await expect(resultPromise).resolves.toEqual(
			expect.objectContaining({
				answerCount: 1,
			}),
		);

		const conversationsPromise = db.select().from(conversations);
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

		const answersPromise = db.select().from(answers);
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
