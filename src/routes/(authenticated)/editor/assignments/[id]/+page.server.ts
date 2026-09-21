import { ElevenLabsError } from "@elevenlabs/elevenlabs-js";
import { error, fail } from "@sveltejs/kit";
import { and, asc, eq, isNotNull, sql } from "drizzle-orm";
import { createUniqueAssignmentSlug } from "$lib/server/assignments";
import type { DbClient } from "$lib/server/db";
import { dbAtomic } from "$lib/server/db";
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
	type ElevenLabsAgentCatalogEntry,
	type ElevenLabsEditorAgent,
	getElevenLabsEditorAgent,
	listElevenLabsDialogbankAgents,
	type Question,
	removeElevenLabsAgentAssignment,
	resolveElevenLabsAgentTargetForAgentId,
	resolveElevenLabsDialogbankAgentTag,
	updateElevenLabsAgentQuestions,
} from "$lib/server/elevenlabs/agent";
import { withAuthenticatedActions, withAuthenticatedLoad } from "$lib/server/require-user";
import { slugify } from "$lib/slugify";
import type { Actions, PageServerLoad } from "./$types";

type NewClassification = { label: string; emoji: string | null };

type QuestionItem = {
	text: string;
	selectedIds: number[];
	newClassifications: NewClassification[];
	displayOrder: number;
};

function parseQuestionItems(formData: FormData): QuestionItem[] {
	const rawTexts = formData.getAll("questions");
	const rawClassificationIds = formData.getAll("question_classification_ids");
	const rawNewClassifications = formData.getAll("question_new_classifications");

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

			let newClassifications: NewClassification[] = [];
			const rawNew = rawNewClassifications[i];
			if (typeof rawNew === "string") {
				try {
					const parsed = JSON.parse(rawNew);
					if (Array.isArray(parsed)) {
						newClassifications = parsed
							.filter(
								(c): c is { label: string; emoji?: string } =>
									typeof c === "object" &&
									c !== null &&
									typeof c.label === "string" &&
									c.label.trim() !== "",
							)
							.map((c) => ({
								label: c.label.trim(),
								emoji: typeof c.emoji === "string" && c.emoji.trim() ? c.emoji.trim() : null,
							}));
					}
				} catch {
					// ignore malformed JSON
				}
			}

			return { text, selectedIds, newClassifications, displayOrder: i };
		})
		.filter((q): q is NonNullable<typeof q> => q !== null);
}

function parseElevenLabsAgentId(formData: FormData): string | null {
	const agentId = (formData.get("elevenLabsAgentId") as string | null)?.trim();
	return agentId || null;
}

type PersistResult = {
	savedRows: { questionId: number; text: string; classificationIds: number[] }[];
	newClassificationRows: { id: number; key: string; label: string }[];
};

function isUniqueConstraintViolation(cause: unknown): boolean {
	let current = cause;
	for (let depth = 0; depth < 4 && current && typeof current === "object"; depth += 1) {
		if ("code" in current && current.code === "23505") return true;
		current = "cause" in current ? current.cause : null;
	}
	return false;
}

async function loadElevenLabsQuestions(db: DbClient, assignmentId: number): Promise<Question[]> {
	const rows = await db
		.select({
			questionId: questions.id,
			text: questions.text,
			displayOrder: questions.displayOrder,
			classificationLabel: classifications.label,
		})
		.from(questions)
		.leftJoin(questionClassifications, eq(questionClassifications.questionId, questions.id))
		.leftJoin(classifications, eq(classifications.id, questionClassifications.classificationId))
		.where(eq(questions.assignmentId, assignmentId))
		.orderBy(asc(questions.displayOrder), asc(questions.id));

	const result = new Map<number, Question>();
	for (const row of rows) {
		const question = result.get(row.questionId) ?? { text: row.text, classifications: [] };
		if (row.classificationLabel && !question.classifications.includes(row.classificationLabel)) {
			question.classifications.push(row.classificationLabel);
		}
		result.set(row.questionId, question);
	}
	return [...result.values()];
}

async function persistQuestions(
	db: DbClient,
	assignmentId: number,
	questionItems: QuestionItem[],
): Promise<PersistResult> {
	const seenKeys = new Set<string>();
	const deduplicatedNew = questionItems
		.flatMap((q) => q.newClassifications)
		.filter((c) => {
			const key = slugify(c.label);
			if (seenKeys.has(key)) return false;
			seenKeys.add(key);
			return true;
		});

	let newClassificationRows: { id: number; key: string; label: string }[] = [];
	const newKeyIdMap = new Map<string, number>();

	if (deduplicatedNew.length > 0) {
		newClassificationRows = await db
			.insert(classifications)
			.values(
				deduplicatedNew.map((c) => ({ key: slugify(c.label), label: c.label, emoji: c.emoji })),
			)
			.onConflictDoUpdate({
				target: classifications.key,
				set: {
					label: sql`EXCLUDED.label`,
					emoji: sql`COALESCE(EXCLUDED.emoji, ${classifications.emoji})`,
				},
			})
			.returning();
		for (const c of newClassificationRows) {
			newKeyIdMap.set(c.key, c.id);
		}
	}

	if (questionItems.length === 0) {
		await db.delete(questions).where(eq(questions.assignmentId, assignmentId));
		return { savedRows: [], newClassificationRows };
	}

	// Pre-fetch IDs from the sequence so all queries can be pre-built for dbAtomic.
	const seqRows = (
		await db.execute(
			sql`SELECT nextval('questions_id_seq') FROM generate_series(1, ${questionItems.length})`,
		)
	).rows as { nextval: string }[];
	const questionIds = seqRows.map((r) => Number(r.nextval));

	const savedRows: { questionId: number; text: string; classificationIds: number[] }[] = [];
	const qcRows: { questionId: number; classificationId: number }[] = [];

	for (let i = 0; i < questionItems.length; i++) {
		const qItem = questionItems[i];
		const questionId = questionIds[i];
		const allIds = [...qItem.selectedIds];
		for (const c of qItem.newClassifications) {
			const newId = newKeyIdMap.get(slugify(c.label));
			if (newId) allIds.push(newId);
		}
		const uniqueIds = [...new Set(allIds)];
		for (const classificationId of uniqueIds) {
			qcRows.push({ questionId, classificationId });
		}
		savedRows.push({ questionId, text: qItem.text, classificationIds: uniqueIds });
	}

	await dbAtomic(db, (client) => {
		const batch: [PromiseLike<unknown>, PromiseLike<unknown>, ...PromiseLike<unknown>[]] = [
			client.delete(questions).where(eq(questions.assignmentId, assignmentId)),
			client.insert(questions).values(
				questionItems.map((q, i) => ({
					id: questionIds[i],
					assignmentId,
					text: q.text,
					displayOrder: q.displayOrder,
				})),
			),
		];
		if (qcRows.length > 0) {
			batch.push(client.insert(questionClassifications).values(qcRows));
		}
		return batch;
	});

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
		.select({
			id: classifications.id,
			key: classifications.key,
			label: classifications.label,
			emoji: classifications.emoji,
		})
		.from(classifications)
		.orderBy(classifications.label);

	const agentCatalogTag = resolveElevenLabsDialogbankAgentTag(process.env);
	let availableAgents: ElevenLabsAgentCatalogEntry[] = [];
	let unavailableAgents: (ElevenLabsAgentCatalogEntry & {
		assignmentId: number;
		assignmentName: string;
	})[] = [];
	let agent: ElevenLabsEditorAgent | null = null;
	try {
		const agentCatalog = await listElevenLabsDialogbankAgents(process.env);
		const ownedAgents = await event.locals.db
			.select({
				assignmentId: assignments.id,
				assignmentName: assignments.name,
				agentId: assignments.elevenLabsAgentId,
			})
			.from(assignments)
			.where(isNotNull(assignments.elevenLabsAgentId));
		const ownersByAgentId = new Map(
			ownedAgents
				.filter((ownedAgent) => ownedAgent.agentId !== null && ownedAgent.assignmentId !== id)
				.map((ownedAgent) => [ownedAgent.agentId as string, ownedAgent]),
		);
		availableAgents = agentCatalog.filter((catalogAgent) => !ownersByAgentId.has(catalogAgent.id));
		unavailableAgents = agentCatalog.flatMap((catalogAgent) => {
			const owner = ownersByAgentId.get(catalogAgent.id);
			return owner
				? [
						{
							...catalogAgent,
							assignmentId: owner.assignmentId,
							assignmentName: owner.assignmentName,
						},
					]
				: [];
		});
	} catch {
		// non-fatal: show catalog as unavailable
	}

	try {
		if (!assignment.elevenLabsAgentId) throw new Error("No assignment agent selected.");
		const agentTarget = await resolveElevenLabsAgentTargetForAgentId(
			process.env,
			assignment.elevenLabsAgentId,
		);
		const reader = createElevenLabsAgentReader(process.env);
		agent = await getElevenLabsEditorAgent(agentTarget, reader);
	} catch {
		// non-fatal: show agent view as unavailable
	}

	return {
		assignment,
		questions: assignmentQuestions,
		allClassifications,
		availableAgents,
		unavailableAgents,
		agentCatalogTag,
		agent,
	};
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

		const slug = await createUniqueAssignmentSlug(event.locals.db, name, id);
		const questionItems = parseQuestionItems(formData);

		await event.locals.db
			.update(assignments)
			.set({ name, slug, location, client, promptSupplement })
			.where(eq(assignments.id, id));
		await persistQuestions(event.locals.db, id, questionItems);

		return {
			success: true,
			action: "save",
			message: "Einsatz gespeichert.",
		};
	},

	connectAgent: async (event) => {
		const id = parseInt(event.params.id, 10);
		if (Number.isNaN(id)) throw error(404, "Einsatz nicht gefunden.");
		const formData = await event.request.formData();
		const selectedAgentId = parseElevenLabsAgentId(formData);

		const [assignment] = await event.locals.db
			.select({
				elevenLabsAgentId: assignments.elevenLabsAgentId,
				promptSupplement: assignments.promptSupplement,
			})
			.from(assignments)
			.where(eq(assignments.id, id))
			.limit(1);
		if (!assignment) throw error(404, "Einsatz nicht gefunden.");

		if (!selectedAgentId) {
			if (!assignment.elevenLabsAgentId) {
				return fail(400, {
					action: "connectAgent",
					message: "Dem Einsatz ist kein Agent zugewiesen.",
				});
			}

			try {
				const agentTarget = await resolveElevenLabsAgentTargetForAgentId(
					process.env,
					assignment.elevenLabsAgentId,
				);
				const reader = createElevenLabsAgentReader(process.env);
				const writer = createElevenLabsAgentWriter(process.env);
				const existingAgent = await reader.get(agentTarget.agentId, {
					branchId: agentTarget.branchId,
				});
				await removeElevenLabsAgentAssignment(agentTarget, existingAgent, writer);
			} catch (cause) {
				if (!(cause instanceof ElevenLabsError)) throw cause;
				return fail(cause.statusCode || 500, {
					action: "connectAgent",
					message: `Agent konnte nicht getrennt werden: ${cause.message || "Unbekannter Fehler"}`,
				});
			}

			await event.locals.db
				.update(assignments)
				.set({ elevenLabsAgentId: null })
				.where(
					and(
						eq(assignments.id, id),
						eq(assignments.elevenLabsAgentId, assignment.elevenLabsAgentId),
					),
				);

			return { success: true, action: "connectAgent", message: "Agent getrennt." };
		}

		if (assignment.elevenLabsAgentId && assignment.elevenLabsAgentId !== selectedAgentId) {
			return fail(409, {
				action: "connectAgent",
				message: "Der aktuelle Agent muss zuerst getrennt werden.",
			});
		}

		const newlyClaimedAgent = !assignment.elevenLabsAgentId;
		if (newlyClaimedAgent) {
			try {
				await event.locals.db
					.update(assignments)
					.set({ elevenLabsAgentId: selectedAgentId })
					.where(eq(assignments.id, id));
			} catch (cause) {
				if (!isUniqueConstraintViolation(cause)) throw cause;
				return fail(409, {
					action: "connectAgent",
					message: "Dieser Agent ist bereits einem anderen Einsatz zugewiesen.",
				});
			}
		}

		try {
			const elevenLabsQuestions = await loadElevenLabsQuestions(event.locals.db, id);
			const agentTarget = await resolveElevenLabsAgentTargetForAgentId(
				process.env,
				selectedAgentId,
			);
			const reader = createElevenLabsAgentReader(process.env);
			const writer = createElevenLabsAgentWriter(process.env);
			const existingAgent: AgentReaderResponse = await reader.get(agentTarget.agentId, {
				branchId: agentTarget.branchId,
			});
			await updateElevenLabsAgentQuestions(
				agentTarget,
				elevenLabsQuestions,
				existingAgent,
				writer,
				{ promptSupplement: assignment.promptSupplement, assignmentId: id },
			);
		} catch (cause) {
			if (newlyClaimedAgent) {
				await event.locals.db
					.update(assignments)
					.set({ elevenLabsAgentId: null })
					.where(and(eq(assignments.id, id), eq(assignments.elevenLabsAgentId, selectedAgentId)));
			}
			if (!(cause instanceof ElevenLabsError)) throw cause;
			return fail(cause.statusCode || 500, {
				action: "connectAgent",
				message: `Agent konnte nicht verbunden werden: ${cause.message || "Unbekannter Fehler"}`,
			});
		}

		return {
			success: true,
			action: "connectAgent",
			message: newlyClaimedAgent ? "Agent verbunden." : "Agent neu konfiguriert.",
		};
	},
});
