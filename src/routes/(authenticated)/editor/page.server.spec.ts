import { createRequestEvent, describe, it } from "$lib/server/test/fixtures";
import { load } from "./+page.server";
import {
	paginatedSupportAnswers,
	sampleAnswersWithSlugCollisions,
	sampleClassifications,
	sampleConversations,
} from "./page.server.spec/data";

describe("/editor +page.server", () => {
	it("defaults invalid page params to the first page", async ({ db, expect, schema }) => {
		await expect(
			db.insert(schema.conversations).values(sampleConversations),
		).resolves.toBeDefined();
		await expect(
			db.insert(schema.classifications).values(sampleClassifications),
		).resolves.toBeDefined();
		await expect(db.insert(schema.answers).values(paginatedSupportAnswers)).resolves.toBeDefined();

		const event = createRequestEvent({
			request: new Request("http://localhost/editor?page_support=Infinity"),
			locals: {
				user: null,
				db,
				schema,
			},
		});

		await expect(load(event as unknown as Parameters<typeof load>[0])).resolves.toEqual(
			expect.objectContaining({
				classificationGroups: expect.arrayContaining([
					expect.objectContaining({
						classification: "Support",
						key: "support",
						pagination: expect.objectContaining({
							page: 1,
							total: 21,
							totalPages: 2,
						}),
					}),
				]),
			}),
		);
	});

	it("uses classification keys for grouping and pagination", async ({ db, expect, schema }) => {
		await expect(
			db.insert(schema.conversations).values(sampleConversations),
		).resolves.toBeDefined();
		await expect(
			db.insert(schema.classifications).values(sampleClassifications),
		).resolves.toBeDefined();
		await expect(
			db.insert(schema.answers).values(sampleAnswersWithSlugCollisions),
		).resolves.toBeDefined();

		const event = createRequestEvent({
			request: new Request("http://localhost/editor"),
			locals: {
				user: null,
				db,
				schema,
			},
		});
		const result = (await load(event as unknown as Parameters<typeof load>[0])) as Exclude<
			Awaited<ReturnType<typeof load>>,
			void
		>;
		const keys = result.classificationGroups.map(
			(group: (typeof result.classificationGroups)[number]) => group.key,
		);

		expect(keys).toEqual(["idea", "support", "unclassified"]);
		expect(new Set(keys).size).toBe(keys.length);
		expect(result.classificationGroups).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					classification: "Unclassified",
					key: "unclassified",
					pagination: expect.objectContaining({
						total: 1,
						totalPages: 1,
					}),
					answers: expect.arrayContaining([
						expect.objectContaining({
							value: "This answer still needs a classification.",
							name: "Mara Klein",
						}),
					]),
				}),
			]),
		);
	});
});
