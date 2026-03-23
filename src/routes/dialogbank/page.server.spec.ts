import { describe, it } from "$lib/server/test/fixtures";
import { load } from "./+page.server";
import { sampleAnswers, sampleClassifications, sampleConversations } from "./page.server.spec/data";

describe("/dialogbank +page.server", () => {
	it("returns counts and published quotes", async ({ db, expect, schema }) => {
		await expect(
			db.insert(schema.conversations).values(sampleConversations),
		).resolves.toBeDefined();
		await expect(
			db.insert(schema.classifications).values(sampleClassifications),
		).resolves.toBeDefined();
		await expect(db.insert(schema.answers).values(sampleAnswers)).resolves.toBeDefined();

		const resultPromise = load({
			locals: {
				user: null,
				db,
				schema,
			},
		} as unknown as Parameters<typeof load>[0]);

		await expect(resultPromise).resolves.toEqual(
			expect.objectContaining({
				guests: 2,
				answerCount: 2,
				classificationCounts: {
					proGelsenkirchen: 1,
					conGelsenkirchen: 0,
					ideaGelsenkirchen: 1,
				},
				quotes: expect.arrayContaining([
					expect.objectContaining({
						text: "Schalke hat Herz.",
						classification: "proGelsenkirchen",
						firstName: "Mara",
						lastName: "Klein",
						age: 32,
					}),
					expect.objectContaining({
						text: "Mehr Parks in der Stadt.",
						classification: "ideaGelsenkirchen",
					}),
				]),
			}),
		);
	});

	it("filters out published answers without visible text", async ({ db, expect, schema }) => {
		await expect(
			db.insert(schema.conversations).values(sampleConversations),
		).resolves.toBeDefined();
		await expect(
			db.insert(schema.classifications).values(sampleClassifications),
		).resolves.toBeDefined();
		await expect(
			db.insert(schema.answers).values([
				...sampleAnswers,
				{
					conversationId: "conv-legacy-1",
					dataCollectionId: "answer_3",
					value: "   ",
					classificationId: 3,
					rationale: "Blank answer",
				},
			]),
		).resolves.toBeDefined();

		const resultPromise = load({
			locals: {
				user: null,
				db,
				schema,
			},
		} as unknown as Parameters<typeof load>[0]);

		await expect(resultPromise).resolves.toEqual(
			expect.objectContaining({
				answerCount: 2,
				classificationCounts: expect.objectContaining({
					conGelsenkirchen: 0,
				}),
				quotes: expect.arrayContaining([
					expect.objectContaining({
						text: "Schalke hat Herz.",
					}),
					expect.objectContaining({
						text: "Mehr Parks in der Stadt.",
					}),
				]),
			}),
		);
	});
});
