import { createRequestEvent, describe, it } from "$lib/server/test/fixtures";
import { actions, load } from "./+page.server";
import {
	classificationDetailAnswers,
	classificationDetailClassifications,
	classificationDetailConversations,
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

async function seedData(
	db: unknown,
	schema: { conversations: unknown; classifications: unknown; answers: unknown },
) {
	const d = db as { insert: (table: unknown) => { values: (rows: unknown) => Promise<unknown> } };
	await d.insert(schema.conversations).values(classificationDetailConversations);
	await d.insert(schema.classifications).values(classificationDetailClassifications);
	await d.insert(schema.answers).values(classificationDetailAnswers);
}

describe("/editor/dashboard/classification/[key] +page.server", () => {
	it("returns answers for the given classification key", async ({ db, expect, schema }) => {
		await seedData(db, schema);

		const event = createRequestEvent({
			request: new Request("http://localhost/editor/dashboard/classification/support"),
			params: { key: "support" } as never,
			locals: { user: authenticatedUser, db, schema },
		});
		const result = (await load(event as unknown as Parameters<typeof load>[0])) as Exclude<
			Awaited<ReturnType<typeof load>>,
			void
		>;

		expect(result.classification).toMatchObject({ key: "support", label: "Support" });
		expect(result.answers).toHaveLength(2);
		expect(
			result.answers.every((a: { classificationId: number | null }) => a.classificationId === 101),
		).toBe(true);
	});

	it("returns unclassified answers for the special key", async ({ db, expect, schema }) => {
		await seedData(db, schema);

		const event = createRequestEvent({
			request: new Request("http://localhost/editor/dashboard/classification/unclassified"),
			params: { key: "unclassified" } as never,
			locals: { user: authenticatedUser, db, schema },
		});
		const result = (await load(event as unknown as Parameters<typeof load>[0])) as Exclude<
			Awaited<ReturnType<typeof load>>,
			void
		>;

		expect(result.classification).toEqual({ key: "unclassified", label: "Nicht klassifiziert" });
		expect(result.answers).toHaveLength(1);
		expect(result.answers[0].classificationId).toBeNull();
	});

	it("throws 404 for an unknown classification key", async ({ db, expect, schema }) => {
		const event = createRequestEvent({
			request: new Request("http://localhost/editor/dashboard/classification/does-not-exist"),
			params: { key: "does-not-exist" } as never,
			locals: { user: authenticatedUser, db, schema },
		});

		await expect(load(event as unknown as Parameters<typeof load>[0])).rejects.toMatchObject({
			status: 404,
		});
	});

	it("classifyAnswer moves an answer to the specified classification", async ({
		db,
		expect,
		schema,
	}) => {
		await seedData(db, schema);

		const formData = new FormData();
		formData.set("answerId", "1003"); // unclassified answer
		formData.set("classificationId", "101"); // move to support

		const event = createRequestEvent({
			request: new Request("http://localhost/editor/dashboard/classification/unclassified", {
				method: "POST",
				body: formData,
			}),
			params: { key: "unclassified" } as never,
			locals: { user: authenticatedUser, db, schema },
		});

		await expect(
			actions.classifyAnswer(event as unknown as Parameters<typeof actions.classifyAnswer>[0]),
		).resolves.toMatchObject({ success: true, answerId: 1003 });

		await expect(
			db.query.answers.findFirst({ where: (a, { eq }) => eq(a.id, 1003) }),
		).resolves.toMatchObject({ classificationId: 101 });
	});
});
