import { eq } from "drizzle-orm";
import { describe, it } from "$lib/server/test/fixtures";
import { processElevenLabsPostCall } from "./storage";
import { samplePayload1, samplePayload2, samplePayload3 } from "./storage.spec/data";

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

	it("creates a classification and links it to the answer via classificationId", async ({
		db,
		expect,
		schema,
	}) => {
		await processElevenLabsPostCall({ db, payload: samplePayload3 });

		const storedClassifications = await db
			.select()
			.from(schema.classifications)
			.where(eq(schema.classifications.key, "idee-fuer-gelsenkirchen"));

		expect(storedClassifications).toHaveLength(1);
		expect(storedClassifications[0].key).toBe("idee-fuer-gelsenkirchen");

		const storedAnswers = await db
			.select()
			.from(schema.answers)
			.where(eq(schema.answers.dataCollectionId, "question_0"));

		expect(storedAnswers).toHaveLength(1);
		expect(storedAnswers[0].classificationId).toBe(storedClassifications[0].id);
	});

	it("does not store classification_N entries as answer rows", async ({ db, expect, schema }) => {
		await processElevenLabsPostCall({ db, payload: samplePayload3 });

		const storedAnswers = await db.select().from(schema.answers);

		expect(storedAnswers).toHaveLength(1);
		expect(storedAnswers[0].dataCollectionId).toBe("question_0");
	});
});
