import { createRequestEvent, describe, it } from "$lib/server/test/fixtures";
import { actions, load } from "./+page.server";
import {
	paginatedSupportAnswers,
	sampleAnswersWithSlugCollisions,
	sampleClassifications,
	sampleConversations,
} from "./page.server.spec/data";

const authenticatedUser = {
	id: "user-1",
	email: "editor@example.com",
	name: "Editor",
	emailVerified: false,
	createdAt: new Date("2026-03-20T00:00:00.000Z"),
	updatedAt: new Date("2026-03-20T00:00:00.000Z"),
	image: null,
};

describe("/editor/dashboard +page.server", () => {
	it("defaults invalid page params to the first page", async ({ db, expect, schema }) => {
		await expect(
			db.insert(schema.conversations).values(sampleConversations),
		).resolves.toBeDefined();
		await expect(
			db.insert(schema.classifications).values(sampleClassifications),
		).resolves.toBeDefined();
		await expect(db.insert(schema.answers).values(paginatedSupportAnswers)).resolves.toBeDefined();

		const event = createRequestEvent({
			request: new Request("http://localhost/editor/dashboard?page_support=Infinity"),
			locals: {
				user: authenticatedUser,
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
			request: new Request("http://localhost/editor/dashboard"),
			locals: {
				user: authenticatedUser,
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
		expect(result.classificationOptions).toEqual([
			{ id: 2, key: "idea", label: "Idea" },
			{ id: 1, key: "support", label: "Support" },
		]);
		expect(result.classificationGroups).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					classification: "Nicht klassifiziert",
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

	it("updates an answer classification from the dashboard action", async ({
		db,
		expect,
		schema,
	}) => {
		await expect(
			db.insert(schema.conversations).values(sampleConversations),
		).resolves.toBeDefined();
		await expect(
			db.insert(schema.classifications).values(sampleClassifications),
		).resolves.toBeDefined();
		await expect(
			db.insert(schema.answers).values(sampleAnswersWithSlugCollisions),
		).resolves.toBeDefined();

		const formData = new FormData();
		formData.set("answerId", "1");
		formData.set("classificationId", "1");

		const event = createRequestEvent({
			request: new Request("http://localhost/editor/dashboard", {
				method: "POST",
				body: formData,
			}),
			locals: {
				user: authenticatedUser,
				db,
				schema,
			},
		});

		await expect(actions.default(event as Parameters<typeof actions.default>[0])).resolves.toEqual({
			answerId: 1,
			message: "Antwort wurde Support zugeordnet.",
			success: true,
		});

		await expect(
			db.query.answers.findFirst({
				where: (answers, { eq }) => eq(answers.id, 1),
			}),
		).resolves.toMatchObject({
			id: 1,
			classificationId: 1,
		});
	});

	it("clears an answer classification from the dashboard action", async ({
		db,
		expect,
		schema,
	}) => {
		await expect(
			db.insert(schema.conversations).values(sampleConversations),
		).resolves.toBeDefined();
		await expect(
			db.insert(schema.classifications).values(sampleClassifications),
		).resolves.toBeDefined();
		await expect(
			db.insert(schema.answers).values(sampleAnswersWithSlugCollisions),
		).resolves.toBeDefined();

		const formData = new FormData();
		formData.set("answerId", "1");
		formData.set("classificationId", "");

		const event = createRequestEvent({
			request: new Request("http://localhost/editor/dashboard", {
				method: "POST",
				body: formData,
			}),
			locals: {
				user: authenticatedUser,
				db,
				schema,
			},
		});

		await expect(actions.default(event as Parameters<typeof actions.default>[0])).resolves.toEqual({
			answerId: 1,
			message: "Antwort wurde als nicht klassifiziert markiert.",
			success: true,
		});

		await expect(
			db.query.answers.findFirst({
				where: (answers, { eq }) => eq(answers.id, 1),
			}),
		).resolves.toMatchObject({
			id: 1,
			classificationId: null,
		});
	});

	it("redirects unauthenticated dashboard actions to sign in", async ({ db, expect, schema }) => {
		const formData = new FormData();
		formData.set("answerId", "1");
		formData.set("classificationId", "1");

		const event = createRequestEvent({
			request: new Request("http://localhost/editor/dashboard", {
				method: "POST",
				body: formData,
			}),
			locals: {
				user: null,
				db,
				schema,
			},
		});

		try {
			await actions.default(event as Parameters<typeof actions.default>[0]);
		} catch (error) {
			expect(error).toMatchObject({
				status: 303,
				location: "/auth/sign-in",
			});
			return;
		}

		throw new Error("Expected unauthenticated dashboard action to redirect to sign in.");
	});
});
