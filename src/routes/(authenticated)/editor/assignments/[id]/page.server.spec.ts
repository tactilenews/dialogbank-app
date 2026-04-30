import { createRequestEvent, describe, it } from "$lib/server/test/fixtures";
import { actions, load } from "./+page.server";

// Use ID ranges that don't collide with other spec files
const CLASSIFICATION_ID_OFFSET = 500;

const authenticatedUser = {
	id: "user-1",
	email: "editor@example.com",
	name: "Editor",
	emailVerified: false,
	createdAt: new Date("2026-03-20T00:00:00.000Z"),
	updatedAt: new Date("2026-03-20T00:00:00.000Z"),
	image: null,
};

describe("/editor/assignments/[id] +page.server", () => {
	it("loads the assignment with its questions and their classifications", async ({
		db,
		expect,
		schema,
	}) => {
		await db.insert(schema.classifications).values([
			{ id: CLASSIFICATION_ID_OFFSET + 1, key: "assign-support", label: "Support" },
			{ id: CLASSIFICATION_ID_OFFSET + 2, key: "assign-idea", label: "Idea" },
		]);
		const [assignment] = await db
			.insert(schema.assignments)
			.values({ name: "Test Assignment" })
			.returning();
		const [q] = await db
			.insert(schema.questions)
			.values({ assignmentId: assignment.id, text: "Wie gefällt dir die Stadt?", displayOrder: 0 })
			.returning();
		await db.insert(schema.questionClassifications).values([
			{ questionId: q.id, classificationId: CLASSIFICATION_ID_OFFSET + 1 },
			{ questionId: q.id, classificationId: CLASSIFICATION_ID_OFFSET + 2 },
		]);

		const event = createRequestEvent({
			request: new Request(`http://localhost/editor/assignments/${assignment.id}`),
			params: { id: String(assignment.id) } as never,
			locals: { user: authenticatedUser, db, schema },
		});
		const result = (await load(event as unknown as Parameters<typeof load>[0])) as Exclude<
			Awaited<ReturnType<typeof load>>,
			void
		>;

		expect(result.questions).toHaveLength(1);
		expect(result.questions[0].text).toBe("Wie gefällt dir die Stadt?");
		expect(result.questions[0].classifications).toHaveLength(2);
		expect(result.questions[0].classifications.map((c: { key: string }) => c.key).sort()).toEqual([
			"assign-idea",
			"assign-support",
		]);
		expect(result.allClassifications).toHaveLength(2);
	});

	it("save: creates new classifications and links them to questions", async ({
		db,
		expect,
		schema,
	}) => {
		const formData = new FormData();
		formData.append("name", "Standard");
		formData.append("questions", "Was denkst du über Gelsenkirchen?");
		formData.append("question_classification_ids", "[]");
		formData.append("question_new_labels", JSON.stringify(["AssignPro", "AssignContra"]));

		const event = createRequestEvent({
			request: new Request("http://localhost/editor/assignments/1", {
				method: "POST",
				body: formData,
			}),
			params: { id: "1" } as never,
			locals: { user: authenticatedUser, db, schema },
		});

		await expect(
			actions.save(event as unknown as Parameters<typeof actions.save>[0]),
		).resolves.toMatchObject({ success: true, action: "save" });

		const pro = await db.query.classifications.findFirst({
			where: (c, { eq }) => eq(c.key, "assignpro"),
		});
		expect(pro).toBeDefined();

		const links = await db.select().from(schema.questionClassifications);
		expect(links).toHaveLength(2);
	});

	it("save: selects existing classifications and links them to questions", async ({
		db,
		expect,
		schema,
	}) => {
		await db
			.insert(schema.classifications)
			.values([{ id: CLASSIFICATION_ID_OFFSET + 20, key: "assign-existing", label: "Existing" }]);

		const formData = new FormData();
		formData.append("name", "Standard");
		formData.append("questions", "Wie läuft es?");
		formData.append("question_classification_ids", JSON.stringify([CLASSIFICATION_ID_OFFSET + 20]));
		formData.append("question_new_labels", "[]");

		const event = createRequestEvent({
			request: new Request("http://localhost/editor/assignments/1", {
				method: "POST",
				body: formData,
			}),
			params: { id: "1" } as never,
			locals: { user: authenticatedUser, db, schema },
		});

		await expect(
			actions.save(event as unknown as Parameters<typeof actions.save>[0]),
		).resolves.toMatchObject({ success: true, action: "save" });

		const links = await db.select().from(schema.questionClassifications);
		expect(links).toHaveLength(1);
		expect(links[0].classificationId).toBe(CLASSIFICATION_ID_OFFSET + 20);
	});

	it("save: replaces existing questions on re-save", async ({ db, expect, schema }) => {
		const save = async (formData: FormData) => {
			const event = createRequestEvent({
				request: new Request("http://localhost/editor/assignments/1", {
					method: "POST",
					body: formData,
				}),
				params: { id: "1" } as never,
				locals: { user: authenticatedUser, db, schema },
			});
			return actions.save(event as unknown as Parameters<typeof actions.save>[0]);
		};

		const fd1 = new FormData();
		fd1.append("name", "Standard");
		fd1.append("questions", "Frage 1");
		fd1.append("questions", "Frage 2");
		fd1.append("question_classification_ids", "[]");
		fd1.append("question_classification_ids", "[]");
		fd1.append("question_new_labels", "[]");
		fd1.append("question_new_labels", "[]");
		await save(fd1);

		const fd2 = new FormData();
		fd2.append("name", "Standard");
		fd2.append("questions", "Nur eine Frage");
		fd2.append("question_classification_ids", "[]");
		fd2.append("question_new_labels", "[]");
		await save(fd2);

		const remaining = await db.select().from(schema.questions);
		expect(remaining).toHaveLength(1);
		expect(remaining[0].text).toBe("Nur eine Frage");
	});
});
