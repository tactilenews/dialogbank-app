import { ElevenLabsError } from "@elevenlabs/elevenlabs-js";
import { error, fail } from "@sveltejs/kit";
import { asc, eq, sql } from "drizzle-orm";
import type { DbClient } from "$lib/server/db";
import {
	assignments,
	classifications,
	questionClassifications,
	questions,
} from "$lib/server/db/schema";
import {
	type AgentReaderResponse,
	createElevenLabsAgentReader,
	createElevenLabsAgentWriter,
	type ElevenLabsEditorAgent,
	getElevenLabsEditorAgent,
	type Question,
	resolveElevenLabsAgentTarget,
	updateElevenLabsAgentQuestions,
} from "$lib/server/elevenlabs/agent";
import { withAuthenticatedActions, withAuthenticatedLoad } from "$lib/server/require-user";
import { slugify } from "$lib/slugify";
import type { Actions, PageServerLoad } from "./$types";

type QuestionItem = {
	text: string;
	selectedIds: number[];
	newLabels: string[];
	displayOrder: number;
};

function parseQuestionItems(formData: FormData): QuestionItem[] {
	const rawTexts = formData.getAll("questions");
	const rawClassificationIds = formData.getAll("question_classification_ids");
	const rawNewLabels = formData.getAll("question_new_labels");

	return rawTexts
		.map((v, i) => {
			const text = typeof v === "string" ? v.trim() : "";
			if (!text) return null;

			let selectedIds: number[] = [];
			const rawIds = rawClassificationIds[i];
			if (typeof rawIds === "string") {
				try {
					const parsed = JSON.parse(rawIds);
					if (Array.isArray(parsed)) {
						selectedIds = parsed.filter(
							(id): id is number => typeof id === "number" && Number.isInteger(id) && id > 0,
						);
					}
				} catch {
					// ignore malformed JSON
				}
			}

			let newLabels: string[] = [];
			const rawNew = rawNewLabels[i];
			if (typeof rawNew === "string") {
				try {
					const parsed = JSON.parse(rawNew);
					if (Array.isArray(parsed)) {
						newLabels = parsed
							.filter((l): l is string => typeof l === "string" && l.trim() !== "")
							.map((l) => l.trim());
					}
				} catch {
					// ignore malformed JSON
				}
			}

			return { text, selectedIds, newLabels, displayOrder: i };
		})
		.filter((q): q is NonNullable<typeof q> => q !== null);
}

type PersistResult = {
	savedRows: { questionId: number; text: string; classificationIds: number[] }[];
	newClassificationRows: { id: number; key: string; label: string }[];
};

async function persistQuestions(
	db: DbClient,
	assignmentId: number,
	questionItems: QuestionItem[],
): Promise<PersistResult> {
	const allNewLabels = [...new Set(questionItems.flatMap((q) => q.newLabels))];
	let newClassificationRows: { id: number; key: string; label: string }[] = [];
	const newLabelIdMap = new Map<string, number>();

	if (allNewLabels.length > 0) {
		newClassificationRows = await db
			.insert(classifications)
			.values(allNewLabels.map((label) => ({ key: slugify(label), label })))
			.onConflictDoUpdate({ target: classifications.key, set: { label: sql`EXCLUDED.label` } })
			.returning();
		for (const c of newClassificationRows) {
			newLabelIdMap.set(c.label, c.id);
		}
	}

	await db.delete(questions).where(eq(questions.assignmentId, assignmentId));

	const savedRows: { questionId: number; text: string; classificationIds: number[] }[] = [];

	if (questionItems.length > 0) {
		const inserted = await db
			.insert(questions)
			.values(
				questionItems.map((q) => ({
					assignmentId,
					text: q.text,
					displayOrder: q.displayOrder,
				})),
			)
			.returning();

		const qcRows: { questionId: number; classificationId: number }[] = [];
		for (let i = 0; i < inserted.length; i++) {
			const qItem = questionItems[i];
			const insertedQ = inserted[i];
			const allIds = [...qItem.selectedIds];
			for (const label of qItem.newLabels) {
				const newId = newLabelIdMap.get(label);
				if (newId) allIds.push(newId);
			}
			const uniqueIds = [...new Set(allIds)];
			for (const classificationId of uniqueIds) {
				qcRows.push({ questionId: insertedQ.id, classificationId });
			}
			savedRows.push({
				questionId: insertedQ.id,
				text: insertedQ.text,
				classificationIds: uniqueIds,
			});
		}
		if (qcRows.length > 0) {
			await db.insert(questionClassifications).values(qcRows);
		}
	}

	return { savedRows, newClassificationRows };
}

export const load = withAuthenticatedLoad<
	Parameters<PageServerLoad>[0],
	ReturnType<PageServerLoad>
>(async (event) => {
	const id = parseInt(event.params.id, 10);
	if (Number.isNaN(id)) throw error(404, "Einsatz nicht gefunden.");

	const [assignment] = await event.locals.db
		.select()
		.from(assignments)
		.where(eq(assignments.id, id))
		.limit(1);

	if (!assignment) throw error(404, "Einsatz nicht gefunden.");

	const rawRows = await event.locals.db
		.select({
			id: questions.id,
			text: questions.text,
			displayOrder: questions.displayOrder,
			classificationId: questionClassifications.classificationId,
			classificationKey: classifications.key,
			classificationLabel: classifications.label,
		})
		.from(questions)
		.leftJoin(questionClassifications, eq(questionClassifications.questionId, questions.id))
		.leftJoin(classifications, eq(classifications.id, questionClassifications.classificationId))
		.where(eq(questions.assignmentId, id))
		.orderBy(asc(questions.displayOrder), asc(questions.id));

	const questionsMap = new Map<
		number,
		{
			id: number;
			text: string;
			displayOrder: number;
			classifications: { id: number; key: string; label: string }[];
		}
	>();
	for (const row of rawRows) {
		if (!questionsMap.has(row.id)) {
			questionsMap.set(row.id, {
				id: row.id,
				text: row.text,
				displayOrder: row.displayOrder,
				classifications: [],
			});
		}
		if (row.classificationId) {
			const entry = questionsMap.get(row.id);
			entry?.classifications.push({
				id: row.classificationId,
				key: row.classificationKey ?? "",
				label: row.classificationLabel ?? "",
			});
		}
	}
	const assignmentQuestions = [...questionsMap.values()];

	const allClassifications = await event.locals.db
		.select({ id: classifications.id, key: classifications.key, label: classifications.label })
		.from(classifications)
		.orderBy(classifications.label);

	let agent: ElevenLabsEditorAgent | null = null;
	try {
		const agentTarget = resolveElevenLabsAgentTarget(process.env);
		const reader = createElevenLabsAgentReader(process.env);
		agent = await getElevenLabsEditorAgent(agentTarget, reader);
	} catch {
		// non-fatal: show agent view as unavailable
	}

	return { assignment, questions: assignmentQuestions, allClassifications, agent };
});

export const actions = withAuthenticatedActions<Parameters<Actions["save"]>[0], Actions>({
	save: async (event) => {
		const id = parseInt(event.params.id, 10);
		if (Number.isNaN(id)) throw error(404, "Einsatz nicht gefunden.");

		const formData = await event.request.formData();
		const name = (formData.get("name") as string | null)?.trim();
		if (!name) return fail(400, { message: "Name ist erforderlich." });

		const location = (formData.get("location") as string | null)?.trim() || null;
		const client = (formData.get("client") as string | null)?.trim() || null;
		const promptSupplement = (formData.get("promptSupplement") as string | null)?.trim() || null;

		await event.locals.db
			.update(assignments)
			.set({ name, location, client, promptSupplement })
			.where(eq(assignments.id, id));

		const questionItems = parseQuestionItems(formData);
		await persistQuestions(event.locals.db, id, questionItems);

		return { success: true, action: "save", message: "Einsatz gespeichert." };
	},

	activate: async (event) => {
		const id = parseInt(event.params.id, 10);
		if (Number.isNaN(id)) throw error(404, "Einsatz nicht gefunden.");

		const formData = await event.request.formData();
		const name = (formData.get("name") as string | null)?.trim();
		if (!name) return fail(400, { message: "Name ist erforderlich." });

		const location = (formData.get("location") as string | null)?.trim() || null;
		const client = (formData.get("client") as string | null)?.trim() || null;
		const promptSupplement = (formData.get("promptSupplement") as string | null)?.trim() || null;

		await event.locals.db
			.update(assignments)
			.set({ name, location, client, promptSupplement })
			.where(eq(assignments.id, id));

		// Load existing classifications for label lookup
		const existingClassifications = await event.locals.db
			.select({ id: classifications.id, label: classifications.label })
			.from(classifications);
		const classificationLabelMap = new Map(existingClassifications.map((c) => [c.id, c.label]));

		const questionItems = parseQuestionItems(formData);
		const { savedRows, newClassificationRows } = await persistQuestions(
			event.locals.db,
			id,
			questionItems,
		);

		// Merge new classification labels into the map
		for (const c of newClassificationRows) {
			classificationLabelMap.set(c.id, c.label);
		}

		// Build ElevenLabs questions
		const elevenLabsQuestions: Question[] = savedRows.map((q) => ({
			text: q.text,
			classifications: q.classificationIds
				.map((cid) => classificationLabelMap.get(cid) ?? "")
				.filter(Boolean),
		}));

		const agentTarget = resolveElevenLabsAgentTarget(process.env);
		const reader = createElevenLabsAgentReader(process.env);
		const writer = createElevenLabsAgentWriter(process.env);

		let existingAgent: AgentReaderResponse;
		try {
			existingAgent = await reader.get(agentTarget.agentId, { branchId: agentTarget.branchId });
		} catch (e) {
			if (!(e instanceof ElevenLabsError)) throw e;
			return fail(e.statusCode || 500, {
				message: `Agent konnte nicht geladen werden: ${e.message || "Unbekannter Fehler"}`,
			});
		}

		try {
			await updateElevenLabsAgentQuestions(
				agentTarget,
				elevenLabsQuestions,
				existingAgent,
				writer,
				{ promptSupplement },
			);
		} catch (e) {
			if (!(e instanceof ElevenLabsError)) throw e;
			return fail(e.statusCode || 500, {
				message: `Agent konnte nicht aktualisiert werden: ${e.message || "Unbekannter Fehler"}`,
			});
		}

		await event.locals.db.update(assignments).set({ isActive: false });
		await event.locals.db.update(assignments).set({ isActive: true }).where(eq(assignments.id, id));

		return {
			success: true,
			action: "activate",
			message: "Einsatz aktiviert und Agent konfiguriert.",
		};
	},
});
