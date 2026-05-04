import { describe, it } from "$lib/server/test/fixtures";
import { load } from "./[name]/+page.server";
import { sampleAnswers, sampleClassifications, sampleConversations } from "./page.server.spec/data";

describe("/showcase/[name] +page.server", () => {
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
			params: { name: "standard" },
		} as unknown as Parameters<typeof load>[0]);

		await expect(resultPromise).resolves.toEqual(
			expect.objectContaining({
				assignmentName: "Standard",
				guests: 2,
				answerCount: 2,
				topClassifications: expect.arrayContaining([
					expect.objectContaining({
						key: "proGelsenkirchen",
						label: "Pro Gelsenkirchen",
						count: 1,
					}),
					expect.objectContaining({
						key: "ideaGelsenkirchen",
						label: "Idea Gelsenkirchen",
						count: 1,
					}),
				]),
				quotes: expect.arrayContaining([
					expect.objectContaining({
						text: "Schalke hat Herz.",
						classificationId: 1,
						firstName: "Mara",
						lastName: "Klein",
						age: 32,
					}),
					expect.objectContaining({
						text: "Mehr Parks in der Stadt.",
						classificationId: 2,
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
			params: { name: "standard" },
		} as unknown as Parameters<typeof load>[0]);

		await expect(resultPromise).resolves.toEqual(
			expect.objectContaining({
				answerCount: 2,
				topClassifications: expect.not.arrayContaining([
					expect.objectContaining({ key: "conGelsenkirchen" }),
				]),
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

	it("resolves showcase data by persisted assignment slug", async ({ db, expect, schema }) => {
		await expect(
			db.insert(schema.classifications).values(sampleClassifications),
		).resolves.toBeDefined();
		await expect(
			db.insert(schema.assignments).values({
				id: 2,
				name: "standard",
				slug: "standard-2",
			}),
		).resolves.toBeDefined();
		await expect(
			db.insert(schema.conversations).values({
				conversationId: "conv-slug-collision",
				agentId: "agent-legacy",
				assignmentId: 2,
				firstName: "Ada",
				publicationAllowed: true,
				callSuccessful: "success",
			}),
		).resolves.toBeDefined();
		await expect(
			db.insert(schema.answers).values({
				conversationId: "conv-slug-collision",
				dataCollectionId: "answer-slug-collision",
				value: "Antwort vom zweiten Einsatz.",
				classificationId: 1,
			}),
		).resolves.toBeDefined();

		const resultPromise = load({
			locals: {
				user: null,
				db,
				schema,
			},
			params: { name: "standard-2" },
		} as unknown as Parameters<typeof load>[0]);

		await expect(resultPromise).resolves.toEqual(
			expect.objectContaining({
				assignmentName: "standard",
				guests: 1,
				answerCount: 1,
				quotes: [
					expect.objectContaining({
						text: "Antwort vom zweiten Einsatz.",
					}),
				],
			}),
		);
	});
});
