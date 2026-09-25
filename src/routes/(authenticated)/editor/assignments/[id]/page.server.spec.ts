import { ElevenLabsError } from "@elevenlabs/elevenlabs-js";
import { eq } from "drizzle-orm";
import { beforeEach, vi } from "vitest";
import { createRequestEvent, describe, it } from "$lib/server/test/fixtures";
import { actions, load } from "./+page.server";

const elevenLabs = vi.hoisted(() => ({
	resolveElevenLabsAgentTargetForAgentId: vi.fn(),
	createElevenLabsAgentReader: vi.fn(),
	createElevenLabsAgentWriter: vi.fn(),
	listElevenLabsDialogbankAgents: vi.fn(),
	removeElevenLabsAgentAssignment: vi.fn(),
	updateElevenLabsAgentQuestions: vi.fn(),
}));

vi.mock("$lib/server/elevenlabs/agent", async (importOriginal) => ({
	...(await importOriginal<typeof import("$lib/server/elevenlabs/agent")>()),
	...elevenLabs,
}));

beforeEach(() => {
	vi.resetAllMocks();
	elevenLabs.resolveElevenLabsAgentTargetForAgentId.mockImplementation(async (_env, agentId) => ({
		agentId,
		branchId: "agtbrch_test",
		workflowNodeId: "node_test",
	}));
	elevenLabs.createElevenLabsAgentReader.mockReturnValue({ get: vi.fn().mockResolvedValue({}) });
	elevenLabs.createElevenLabsAgentWriter.mockReturnValue({ update: vi.fn() });
	elevenLabs.listElevenLabsDialogbankAgents.mockResolvedValue([
		{ id: "agent_current", name: "Nadia", voiceId: null, tags: ["dialogbank"], archived: false },
		{ id: "agent_available", name: "Mara", voiceId: null, tags: ["dialogbank"], archived: false },
	]);
	elevenLabs.updateElevenLabsAgentQuestions.mockResolvedValue("agtvrsn_new");
});

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
			.values({ name: "Test Assignment", slug: "test-assignment" })
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
		formData.append(
			"question_new_classifications",
			JSON.stringify([
				{ label: "AssignPro", emoji: "💡" },
				{ label: "AssignContra", emoji: null },
			]),
		);

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

	it("save: returns 404 when the assignment no longer exists", async ({ db, expect, schema }) => {
		await db.delete(schema.assignments).where(eq(schema.assignments.id, 1));
		const formData = new FormData();
		formData.append("name", "Deleted assignment");
		const event = createRequestEvent({
			request: new Request("http://localhost/editor/assignments/1?/save", {
				method: "POST",
				body: formData,
			}),
			params: { id: "1" } as never,
			locals: { user: authenticatedUser, db, schema },
		});

		await expect(
			actions.save(event as unknown as Parameters<typeof actions.save>[0]),
		).rejects.toMatchObject({ status: 404 });
	});

	it("save: rolls back assignment metadata when question persistence fails", async ({
		db,
		expect,
		schema,
	}) => {
		await db
			.insert(schema.questions)
			.values({ assignmentId: 1, text: "Bestehende Frage", displayOrder: 0 });
		const formData = new FormData();
		formData.append("name", "Nicht gespeichert");
		formData.append("questions", "Ungültige Frage");
		formData.append("question_classification_ids", "[999999]");
		formData.append("question_new_classifications", "[]");
		const event = createRequestEvent({
			request: new Request("http://localhost/editor/assignments/1?/save", {
				method: "POST",
				body: formData,
			}),
			params: { id: "1" } as never,
			locals: { user: authenticatedUser, db, schema },
		});

		await expect(
			actions.save(event as unknown as Parameters<typeof actions.save>[0]),
		).rejects.toBeDefined();
		await expect(db.query.assignments.findFirst()).resolves.toMatchObject({ name: "Standard" });
		await expect(db.select().from(schema.questions)).resolves.toEqual([
			expect.objectContaining({ text: "Bestehende Frage" }),
		]);
	});

	it("connectAgent: rejects an agent owned by another assignment", async ({
		db,
		expect,
		schema,
	}) => {
		await db.insert(schema.assignments).values({
			name: "Another Assignment",
			slug: "another-assignment",
			elevenLabsAgentId: "agent_dialogbank_123",
		});
		const formData = new FormData();
		formData.append("name", "Standard");
		formData.append("elevenLabsAgentId", "agent_dialogbank_123");

		const event = createRequestEvent({
			request: new Request("http://localhost/editor/assignments/1", {
				method: "POST",
				body: formData,
			}),
			params: { id: "1" } as never,
			locals: { user: authenticatedUser, db, schema },
		});

		await expect(
			actions.connectAgent(event as unknown as Parameters<typeof actions.connectAgent>[0]),
		).resolves.toMatchObject({
			status: 409,
			data: {
				action: "connectAgent",
				message: "Dieser Agent ist bereits einem anderen Einsatz zugewiesen.",
			},
		});

		const assignment = await db.query.assignments.findFirst({
			where: (a, { eq }) => eq(a.id, 1),
		});
		expect(assignment?.elevenLabsAgentId).toBeNull();
	});

	it("save: links duplicate new classifications by normalized key", async ({
		db,
		expect,
		schema,
	}) => {
		const formData = new FormData();
		formData.append("name", "Standard");
		formData.append("questions", "Frage 1");
		formData.append("questions", "Frage 2");
		formData.append("question_classification_ids", "[]");
		formData.append("question_classification_ids", "[]");
		formData.append(
			"question_new_classifications",
			JSON.stringify([{ label: "Assign Pro", emoji: null }]),
		);
		formData.append(
			"question_new_classifications",
			JSON.stringify([{ label: "assign-pro", emoji: null }]),
		);

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

		const created = await db.query.classifications.findMany({
			where: (c, { eq }) => eq(c.key, "assign-pro"),
		});
		expect(created).toHaveLength(1);

		const links = await db.select().from(schema.questionClassifications);
		expect(links).toHaveLength(2);
		expect(new Set(links.map((link) => link.classificationId))).toEqual(new Set([created[0].id]));
	});

	it("save: does not overwrite existing emoji when upserting a classification without one", async ({
		db,
		expect,
		schema,
	}) => {
		await db
			.insert(schema.classifications)
			.values([{ key: "assign-pro", label: "Assign Pro", emoji: "💡" }]);

		const formData = new FormData();
		formData.append("name", "Standard");
		formData.append("questions", "Frage 1");
		formData.append("question_classification_ids", "[]");
		formData.append(
			"question_new_classifications",
			JSON.stringify([{ label: "Assign Pro", emoji: null }]),
		);

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
		).resolves.toMatchObject({ success: true });

		const [updated] = await db.query.classifications.findMany({
			where: (c, { eq }) => eq(c.key, "assign-pro"),
		});
		expect(updated.emoji).toBe("💡");
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
		formData.append("question_new_classifications", "[]");

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
		fd1.append("question_new_classifications", "[]");
		fd1.append("question_new_classifications", "[]");
		await save(fd1);

		const fd2 = new FormData();
		fd2.append("name", "Standard");
		fd2.append("questions", "Nur eine Frage");
		fd2.append("question_classification_ids", "[]");
		fd2.append("question_new_classifications", "[]");
		await save(fd2);

		const remaining = await db.select().from(schema.questions);
		expect(remaining).toHaveLength(1);
		expect(remaining[0].text).toBe("Nur eine Frage");
	});

	it("save: configures the connected agent, not the one selected in the form", async ({
		db,
		expect,
		schema,
	}) => {
		await db
			.update(schema.assignments)
			.set({ elevenLabsAgentId: "agent_current" })
			.where(eq(schema.assignments.id, 1));
		const formData = new FormData();
		formData.append("name", "Standard");
		formData.append("elevenLabsAgentId", "agent_replacement");
		formData.append("questions", "Frage 1");
		formData.append("question_classification_ids", "[]");
		formData.append("question_new_classifications", "[]");

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
		).resolves.toMatchObject({
			success: true,
			action: "save",
		});
		const assignment = await db.query.assignments.findFirst({
			where: (row, { eq }) => eq(row.id, 1),
		});
		expect(assignment?.elevenLabsAgentId).toBe("agent_current");
		expect(elevenLabs.resolveElevenLabsAgentTargetForAgentId).toHaveBeenCalledWith(
			expect.anything(),
			"agent_current",
		);
	});

	it("save: preserves agent ownership when the assignment form has no agent field", async ({
		db,
		expect,
		schema,
	}) => {
		await db
			.update(schema.assignments)
			.set({ elevenLabsAgentId: "agent_current" })
			.where(eq(schema.assignments.id, 1));
		const formData = new FormData();
		formData.append("name", "Standard");
		const event = createRequestEvent({
			request: new Request("http://localhost/editor/assignments/1?/save", {
				method: "POST",
				body: formData,
			}),
			params: { id: "1" } as never,
			locals: { user: authenticatedUser, db, schema },
		});

		await expect(
			actions.save(event as unknown as Parameters<typeof actions.save>[0]),
		).resolves.toMatchObject({ success: true, action: "save" });

		const assignment = await db.query.assignments.findFirst({
			where: (row, { eq }) => eq(row.id, 1),
		});
		expect(assignment?.elevenLabsAgentId).toBe("agent_current");
	});

	it("save: leaves ElevenLabs alone when no agent is connected", async ({ db, expect, schema }) => {
		const formData = new FormData();
		formData.append("name", "Standard");
		const event = createRequestEvent({
			request: new Request("http://localhost/editor/assignments/1?/save", {
				method: "POST",
				body: formData,
			}),
			params: { id: "1" } as never,
			locals: { user: authenticatedUser, db, schema },
		});

		await expect(
			actions.save(event as unknown as Parameters<typeof actions.save>[0]),
		).resolves.toEqual({ success: true, action: "save", message: "Einsatz gespeichert." });
		expect(elevenLabs.updateElevenLabsAgentQuestions).not.toHaveBeenCalled();
	});

	it("save: configures the connected agent with the saved assignment", async ({
		db,
		expect,
		schema,
	}) => {
		await db
			.update(schema.assignments)
			.set({ elevenLabsAgentId: "agent_current", agentConfigurationError: "old error" })
			.where(eq(schema.assignments.id, 1));
		const formData = new FormData();
		formData.append("name", "Standard");
		formData.append("promptSupplement", "Sei freundlich.");
		formData.append("questions", "Neue Frage");
		formData.append("question_classification_ids", "[]");
		formData.append("question_new_classifications", "[]");
		const event = createRequestEvent({
			request: new Request("http://localhost/editor/assignments/1?/save", {
				method: "POST",
				body: formData,
			}),
			params: { id: "1" } as never,
			locals: { user: authenticatedUser, db, schema },
		});

		await expect(
			actions.save(event as unknown as Parameters<typeof actions.save>[0]),
		).resolves.toEqual({
			success: true,
			action: "save",
			message: "Einsatz gespeichert und Agent aktualisiert.",
		});

		expect(elevenLabs.updateElevenLabsAgentQuestions).toHaveBeenCalledWith(
			expect.objectContaining({ agentId: "agent_current", branchId: "agtbrch_test" }),
			[{ text: "Neue Frage", classifications: [] }],
			expect.anything(),
			expect.anything(),
			{ promptSupplement: "Sei freundlich.", assignmentId: 1 },
		);
		const assignment = await db.query.assignments.findFirst({
			where: (row, { eq }) => eq(row.id, 1),
		});
		expect(assignment).toMatchObject({
			elevenLabsAgentVersionId: "agtvrsn_new",
			agentConfigurationError: null,
		});
		expect(assignment?.agentConfiguredAt).toEqual(assignment?.updatedAt);
	});

	it("save: keeps the assignment and records the error when the agent cannot be updated", async ({
		db,
		expect,
		schema,
	}) => {
		await db
			.update(schema.assignments)
			.set({ elevenLabsAgentId: "agent_current" })
			.where(eq(schema.assignments.id, 1));
		elevenLabs.updateElevenLabsAgentQuestions.mockRejectedValue(
			new ElevenLabsError({ message: "ElevenLabs unavailable", statusCode: 503 }),
		);
		const formData = new FormData();
		formData.append("name", "Umbenannt");
		const event = createRequestEvent({
			request: new Request("http://localhost/editor/assignments/1?/save", {
				method: "POST",
				body: formData,
			}),
			params: { id: "1" } as never,
			locals: { user: authenticatedUser, db, schema },
		});

		await expect(
			actions.save(event as unknown as Parameters<typeof actions.save>[0]),
		).resolves.toMatchObject({
			status: 503,
			data: {
				action: "save",
				message: expect.stringMatching(
					/^Einsatz gespeichert, aber der Agent konnte nicht aktualisiert werden: .*ElevenLabs unavailable/,
				),
			},
		});

		const assignment = await db.query.assignments.findFirst({
			where: (row, { eq }) => eq(row.id, 1),
		});
		expect(assignment?.name).toBe("Umbenannt");
		expect(assignment?.agentConfigurationError).toContain("ElevenLabs unavailable");
	});

	it("connectAgent: saves the assignment before configuring the new agent with it", async ({
		db,
		expect,
		schema,
	}) => {
		const formData = new FormData();
		formData.append("name", "Ungespeicherter Name");
		formData.append("elevenLabsAgentId", "agent_available");
		formData.append("questions", "Ungespeicherte Frage");
		formData.append("question_classification_ids", "[]");
		formData.append("question_new_classifications", "[]");
		const event = createRequestEvent({
			request: new Request("http://localhost/editor/assignments/1?/connectAgent", {
				method: "POST",
				body: formData,
			}),
			params: { id: "1" } as never,
			locals: { user: authenticatedUser, db, schema },
		});

		await expect(
			actions.connectAgent(event as unknown as Parameters<typeof actions.connectAgent>[0]),
		).resolves.toEqual({
			success: true,
			action: "connectAgent",
			message: "Einsatz gespeichert und Agent verbunden.",
		});

		expect(elevenLabs.updateElevenLabsAgentQuestions).toHaveBeenCalledWith(
			expect.objectContaining({ agentId: "agent_available" }),
			[{ text: "Ungespeicherte Frage", classifications: [] }],
			expect.anything(),
			expect.anything(),
			expect.anything(),
		);
		await expect(
			db.query.assignments.findFirst({ where: (row, { eq }) => eq(row.id, 1) }),
		).resolves.toMatchObject({
			name: "Ungespeicherter Name",
			elevenLabsAgentId: "agent_available",
			elevenLabsAgentVersionId: "agtvrsn_new",
		});
	});

	it("connectAgent: rejects disconnecting when no agent is connected", async ({
		db,
		expect,
		schema,
	}) => {
		const formData = new FormData();
		formData.append("name", "Standard");
		const event = createRequestEvent({
			request: new Request("http://localhost/editor/assignments/1?/connectAgent", {
				method: "POST",
				body: formData,
			}),
			params: { id: "1" } as never,
			locals: { user: authenticatedUser, db, schema },
		});

		await expect(
			actions.connectAgent(event as unknown as Parameters<typeof actions.connectAgent>[0]),
		).resolves.toMatchObject({
			status: 400,
			data: {
				action: "connectAgent",
				message: "Dem Einsatz ist kein Agent zugewiesen.",
			},
		});
	});

	it("load: does not resolve an agent outside the catalog, which could create a branch on it", async ({
		db,
		expect,
		schema,
	}) => {
		await db
			.update(schema.assignments)
			.set({ elevenLabsAgentId: "agent_untagged" })
			.where(eq(schema.assignments.id, 1));
		const event = createRequestEvent({
			request: new Request("http://localhost/editor/assignments/1"),
			params: { id: "1" } as never,
			locals: { user: authenticatedUser, db, schema },
		});

		await expect(load(event as unknown as Parameters<typeof load>[0])).resolves.toMatchObject({
			agent: null,
		});
		expect(elevenLabs.resolveElevenLabsAgentTargetForAgentId).not.toHaveBeenCalled();
	});

	it("save: keeps the assignment but leaves an agent outside the catalog untouched", async ({
		db,
		expect,
		schema,
	}) => {
		await db
			.update(schema.assignments)
			.set({ elevenLabsAgentId: "agent_untagged" })
			.where(eq(schema.assignments.id, 1));
		const formData = new FormData();
		formData.append("name", "Umbenannt");
		const event = createRequestEvent({
			request: new Request("http://localhost/editor/assignments/1?/save", {
				method: "POST",
				body: formData,
			}),
			params: { id: "1" } as never,
			locals: { user: authenticatedUser, db, schema },
		});

		await expect(
			actions.save(event as unknown as Parameters<typeof actions.save>[0]),
		).resolves.toMatchObject({
			status: 409,
			data: {
				action: "save",
				message:
					"Einsatz gespeichert, aber der Agent konnte nicht aktualisiert werden: Der Agent ist nicht mit dem Tag dialogbank für die Dialogbank freigegeben.",
			},
		});
		expect(elevenLabs.resolveElevenLabsAgentTargetForAgentId).not.toHaveBeenCalled();
		expect(elevenLabs.updateElevenLabsAgentQuestions).not.toHaveBeenCalled();
		await expect(
			db.query.assignments.findFirst({ where: (row, { eq }) => eq(row.id, 1) }),
		).resolves.toMatchObject({
			name: "Umbenannt",
			agentConfigurationError: expect.stringContaining("nicht mit dem Tag dialogbank"),
		});
	});

	it("connectAgent: removes the assignment from a catalog agent when disconnecting", async ({
		db,
		expect,
		schema,
	}) => {
		await db
			.update(schema.assignments)
			.set({ elevenLabsAgentId: "agent_current" })
			.where(eq(schema.assignments.id, 1));
		const formData = new FormData();
		formData.append("name", "Standard");
		const event = createRequestEvent({
			request: new Request("http://localhost/editor/assignments/1?/connectAgent", {
				method: "POST",
				body: formData,
			}),
			params: { id: "1" } as never,
			locals: { user: authenticatedUser, db, schema },
		});

		await expect(
			actions.connectAgent(event as unknown as Parameters<typeof actions.connectAgent>[0]),
		).resolves.toEqual({
			success: true,
			action: "connectAgent",
			message: "Einsatz gespeichert und Agent getrennt.",
		});
		expect(elevenLabs.removeElevenLabsAgentAssignment).toHaveBeenCalledOnce();
		await expect(
			db.query.assignments.findFirst({ where: (row, { eq }) => eq(row.id, 1) }),
		).resolves.toMatchObject({ elevenLabsAgentId: null });
	});

	it("connectAgent: only detaches an agent outside the catalog without touching it", async ({
		db,
		expect,
		schema,
	}) => {
		await db
			.update(schema.assignments)
			.set({ elevenLabsAgentId: "agent_untagged" })
			.where(eq(schema.assignments.id, 1));
		const formData = new FormData();
		formData.append("name", "Standard");
		const event = createRequestEvent({
			request: new Request("http://localhost/editor/assignments/1?/connectAgent", {
				method: "POST",
				body: formData,
			}),
			params: { id: "1" } as never,
			locals: { user: authenticatedUser, db, schema },
		});

		await expect(
			actions.connectAgent(event as unknown as Parameters<typeof actions.connectAgent>[0]),
		).resolves.toMatchObject({
			success: true,
			message: expect.stringContaining("enthält weiterhin die ID dieses Einsatzes"),
		});
		expect(elevenLabs.resolveElevenLabsAgentTargetForAgentId).not.toHaveBeenCalled();
		expect(elevenLabs.removeElevenLabsAgentAssignment).not.toHaveBeenCalled();
		await expect(
			db.query.assignments.findFirst({ where: (row, { eq }) => eq(row.id, 1) }),
		).resolves.toMatchObject({ elevenLabsAgentId: null });
	});

	it("connectAgent: keeps the agent connected when the catalog cannot be checked", async ({
		db,
		expect,
		schema,
	}) => {
		await db
			.update(schema.assignments)
			.set({ elevenLabsAgentId: "agent_current" })
			.where(eq(schema.assignments.id, 1));
		elevenLabs.listElevenLabsDialogbankAgents.mockRejectedValue(
			new ElevenLabsError({ message: "ElevenLabs unavailable", statusCode: 503 }),
		);
		const formData = new FormData();
		formData.append("name", "Standard");
		const event = createRequestEvent({
			request: new Request("http://localhost/editor/assignments/1?/connectAgent", {
				method: "POST",
				body: formData,
			}),
			params: { id: "1" } as never,
			locals: { user: authenticatedUser, db, schema },
		});

		await expect(
			actions.connectAgent(event as unknown as Parameters<typeof actions.connectAgent>[0]),
		).resolves.toMatchObject({ status: 503 });
		expect(elevenLabs.removeElevenLabsAgentAssignment).not.toHaveBeenCalled();
		await expect(
			db.query.assignments.findFirst({ where: (row, { eq }) => eq(row.id, 1) }),
		).resolves.toMatchObject({ elevenLabsAgentId: "agent_current" });
	});
});
