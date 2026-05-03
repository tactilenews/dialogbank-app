import { createRequestEvent, describe, it } from "$lib/server/test/fixtures";
import { actions, load } from "./+page.server";
import {
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
	it("returns classification options with answer counts", async ({ db, expect, schema }) => {
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
			locals: { user: authenticatedUser, db, schema },
		});

		const result = (await load(event as unknown as Parameters<typeof load>[0])) as Exclude<
			Awaited<ReturnType<typeof load>>,
			void
		>;

		expect(result.classificationOptions).toEqual([
			{ id: 2, key: "idea", label: "Idea", answerCount: 2 },
			{ id: 1, key: "support", label: "Support", answerCount: 2 },
		]);
		expect(result.unclassifiedCount).toBe(1);
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
			locals: { user: authenticatedUser, db, schema },
		});

		await expect(
			actions.classifyAnswer(event as Parameters<typeof actions.classifyAnswer>[0]),
		).resolves.toEqual({
			answerId: 1,
			message: "Antwort wurde Support zugeordnet.",
			success: true,
		});

		await expect(
			db.query.answers.findFirst({ where: (answers, { eq }) => eq(answers.id, 1) }),
		).resolves.toMatchObject({ id: 1, classificationId: 1 });
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
			locals: { user: authenticatedUser, db, schema },
		});

		await expect(
			actions.classifyAnswer(event as Parameters<typeof actions.classifyAnswer>[0]),
		).resolves.toEqual({
			answerId: 1,
			message: "Antwort wurde als nicht klassifiziert markiert.",
			success: true,
		});

		await expect(
			db.query.answers.findFirst({ where: (answers, { eq }) => eq(answers.id, 1) }),
		).resolves.toMatchObject({ id: 1, classificationId: null });
	});

	it("returns a warning when deleting a classification that has answers", async ({
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
		formData.set("id", "1"); // support classification, has 2 answers

		const event = createRequestEvent({
			request: new Request("http://localhost/editor/dashboard", {
				method: "POST",
				body: formData,
			}),
			locals: { user: authenticatedUser, db, schema },
		});

		const result = await actions.deleteClassification(
			event as Parameters<typeof actions.deleteClassification>[0],
		);

		expect(result).toMatchObject({
			status: 409,
			data: expect.objectContaining({
				classificationWarning: expect.stringContaining("2 Antworten"),
				confirmDeleteId: 1,
			}),
		});

		// Classification should NOT have been deleted
		await expect(
			db.query.classifications.findFirst({ where: (c, { eq }) => eq(c.id, 1) }),
		).resolves.toBeDefined();
	});

	it("deletes a classification and unclassifies its answers when confirmed", async ({
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
		formData.set("id", "1"); // support classification
		formData.set("confirmed", "true");

		const event = createRequestEvent({
			request: new Request("http://localhost/editor/dashboard", {
				method: "POST",
				body: formData,
			}),
			locals: { user: authenticatedUser, db, schema },
		});

		await expect(
			actions.deleteClassification(event as Parameters<typeof actions.deleteClassification>[0]),
		).resolves.toMatchObject({ classificationSuccess: true });

		// Classification should be gone
		await expect(
			db.query.classifications.findFirst({ where: (c, { eq }) => eq(c.id, 1) }),
		).resolves.toBeUndefined();

		// Answers that had this classification should be unclassified (onDelete: set null)
		await expect(
			db.query.answers.findFirst({ where: (a, { eq }) => eq(a.id, 1) }),
		).resolves.toMatchObject({ classificationId: null });
	});

	it("deletes a classification with no answers without warning", async ({ db, expect, schema }) => {
		await expect(
			db.insert(schema.classifications).values(sampleClassifications),
		).resolves.toBeDefined();

		const formData = new FormData();
		formData.set("id", "2"); // idea classification, no answers

		const event = createRequestEvent({
			request: new Request("http://localhost/editor/dashboard", {
				method: "POST",
				body: formData,
			}),
			locals: { user: authenticatedUser, db, schema },
		});

		await expect(
			actions.deleteClassification(event as Parameters<typeof actions.deleteClassification>[0]),
		).resolves.toMatchObject({
			classificationSuccess: true,
			classificationMessage: expect.any(String),
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
			locals: { user: null, db, schema },
		});

		try {
			await actions.classifyAnswer(event as Parameters<typeof actions.classifyAnswer>[0]);
		} catch (error) {
			expect(error).toMatchObject({ status: 303, location: "/auth/sign-in" });
			return;
		}

		throw new Error("Expected unauthenticated dashboard action to redirect to sign in.");
	});
});
