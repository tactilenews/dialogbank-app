import { ElevenLabsError } from "@elevenlabs/elevenlabs-js";
import { error, fail, isHttpError } from "@sveltejs/kit";
import { and, asc, eq, isNotNull, isNull, sql } from "drizzle-orm";
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
	createElevenLabsAgentReader,
	createElevenLabsAgentWriter,
	type ElevenLabsAgentCatalogEntry,
	type ElevenLabsEditorAgent,
	getElevenLabsEditorAgent,
	isSelectableDialogbankAgent,
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

type AssignmentValues = {
	name: string;
	slug: string;
	location: string | null;
	client: string | null;
	promptSupplement: string | null;
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

async function persistAssignmentAndQuestions(
	db: DbClient,
	assignmentId: number,
	questionItems: QuestionItem[],
	assignmentValues: AssignmentValues,
): Promise<boolean> {
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
		const [savedAssignments] = await dbAtomic(db, (client) => [
			client
				.update(assignments)
				.set(assignmentValues)
				.where(eq(assignments.id, assignmentId))
				.returning(),
			client.delete(questions).where(eq(questions.assignmentId, assignmentId)),
		]);
		return Array.isArray(savedAssignments) && savedAssignments.length > 0;
	}

	// Pre-fetch IDs from the sequence so all queries can be pre-built for dbAtomic.
	const seqRows = (
		await db.execute(
			sql`SELECT nextval('questions_id_seq') FROM generate_series(1, ${questionItems.length})`,
		)
	).rows as { nextval: string }[];
	const questionIds = seqRows.map((r) => Number(r.nextval));

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
	}

	const [savedAssignments] = await dbAtomic(db, (client) => {
		const batch: [PromiseLike<unknown>, PromiseLike<unknown>, ...PromiseLike<unknown>[]] = [
			client
				.update(assignments)
				.set(assignmentValues)
				.where(eq(assignments.id, assignmentId))
				.returning(),
			client.delete(questions).where(eq(questions.assignmentId, assignmentId)),
		];
		batch.push(
			client.insert(questions).values(
				questionItems.map((q, i) => ({
					id: questionIds[i],
					assignmentId,
					text: q.text,
					displayOrder: q.displayOrder,
				})),
			),
		);
		if (qcRows.length > 0) {
			batch.push(client.insert(questionClassifications).values(qcRows));
		}
		return batch;
	});

	return Array.isArray(savedAssignments) && savedAssignments.length > 0;
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
	let agentCatalog: ElevenLabsAgentCatalogEntry[] = [];
	try {
		agentCatalog = await listElevenLabsDialogbankAgents(process.env);
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
		// Resolving the target can create a branch on the agent.
		if (
			!agentCatalog.some((catalogAgent) =>
				isDialogbankAgent(catalogAgent, assignment.elevenLabsAgentId, agentCatalogTag),
			)
		) {
			throw new Error("The assignment agent is not in the Dialogbank catalog.");
		}
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

function describeError(cause: unknown): string {
	if (isHttpError(cause)) return cause.body.message;
	return cause instanceof Error && cause.message ? cause.message : "Unbekannter Fehler";
}

function errorStatus(cause: unknown): number {
	if (cause instanceof ElevenLabsError) return cause.statusCode || 502;
	if (isHttpError(cause)) return cause.status;
	return 500;
}

function isDialogbankAgent(
	catalogAgent: ElevenLabsAgentCatalogEntry,
	agentId: string | null,
	requiredTag: string,
): boolean {
	return catalogAgent.id === agentId && isSelectableDialogbankAgent(catalogAgent, requiredTag);
}

// Dialogbank never writes to an agent outside its catalog, not even to clean up
// after itself. Throws when the catalog cannot be loaded, since the agent then
// cannot be checked.
async function isInDialogbankCatalog(agentId: string): Promise<boolean> {
	const requiredTag = resolveElevenLabsDialogbankAgentTag(process.env);
	const agentCatalog = await listElevenLabsDialogbankAgents(process.env);
	return agentCatalog.some((catalogAgent) => isDialogbankAgent(catalogAgent, agentId, requiredTag));
}

function notInCatalogMessage(): string {
	return `Der Agent ist nicht mit dem Tag ${resolveElevenLabsDialogbankAgentTag(process.env)} für die Dialogbank freigegeben.`;
}

function parseAssignmentId(rawId: string): number {
	const id = parseInt(rawId, 10);
	if (Number.isNaN(id)) throw error(404, "Einsatz nicht gefunden.");
	return id;
}

// Every action on the page submits the assignment form, so what the editor sees
// is what gets saved, and what gets configured on the agent.
async function saveAssignmentForm(db: DbClient, id: number, formData: FormData) {
	const name = (formData.get("name") as string | null)?.trim();
	if (!name) return fail(400, { message: "Name ist erforderlich." });

	const location = (formData.get("location") as string | null)?.trim() || null;
	const client = (formData.get("client") as string | null)?.trim() || null;
	const promptSupplement = (formData.get("promptSupplement") as string | null)?.trim() || null;

	const slug = await createUniqueAssignmentSlug(db, name, id);
	const questionItems = parseQuestionItems(formData);

	const saved = await persistAssignmentAndQuestions(db, id, questionItems, {
		name,
		slug,
		location,
		client,
		promptSupplement,
	});
	if (!saved) {
		throw error(404, "Einsatz nicht gefunden.");
	}
}

async function loadAssignmentAgentId(db: DbClient, id: number): Promise<string | null> {
	const [assignment] = await db
		.select({ elevenLabsAgentId: assignments.elevenLabsAgentId })
		.from(assignments)
		.where(eq(assignments.id, id))
		.limit(1);
	if (!assignment) throw error(404, "Einsatz nicht gefunden.");
	return assignment.elevenLabsAgentId;
}

type AgentConfigurationResult = { ok: true } | { ok: false; status: number; message: string };

// Writes the saved assignment to its agent. The database stays the source of
// truth: a failed write is recorded for the editor to retry, never rolled back.
async function configureAssignmentAgent(
	db: DbClient,
	id: number,
	agentId: string,
): Promise<AgentConfigurationResult> {
	const ownedByAgent = and(eq(assignments.id, id), eq(assignments.elevenLabsAgentId, agentId));
	try {
		const [assignment] = await db
			.select({ promptSupplement: assignments.promptSupplement })
			.from(assignments)
			.where(ownedByAgent)
			.limit(1);
		if (!assignment) throw error(409, "Der Agent ist dem Einsatz nicht mehr zugewiesen.");
		if (!(await isInDialogbankCatalog(agentId))) throw error(409, notInCatalogMessage());
		const elevenLabsQuestions = await loadElevenLabsQuestions(db, id);
		const agentTarget = await resolveElevenLabsAgentTargetForAgentId(process.env, agentId);
		const reader = createElevenLabsAgentReader(process.env);
		const writer = createElevenLabsAgentWriter(process.env);
		const existingAgent = await reader.get(agentTarget.agentId, {
			branchId: agentTarget.branchId,
		});
		const versionId = await updateElevenLabsAgentQuestions(
			agentTarget,
			elevenLabsQuestions,
			existingAgent,
			writer,
			{ promptSupplement: assignment.promptSupplement, assignmentId: id },
		);
		// Sharing one timestamp lets the page tell whether the assignment changed
		// after its agent was last configured.
		const configuredAt = new Date();
		await db
			.update(assignments)
			.set({
				elevenLabsAgentVersionId: versionId,
				agentConfiguredAt: configuredAt,
				agentConfigurationError: null,
				updatedAt: configuredAt,
			})
			.where(ownedByAgent);
		return { ok: true };
	} catch (cause) {
		const message = describeError(cause);
		await db.update(assignments).set({ agentConfigurationError: message }).where(ownedByAgent);
		return { ok: false, status: errorStatus(cause), message };
	}
}

type AgentDisconnectResult =
	| { ok: true; agentWasInCatalog: boolean }
	| { ok: false; status: number; message: string };

async function disconnectAssignmentAgent(
	db: DbClient,
	id: number,
	agentId: string,
): Promise<AgentDisconnectResult> {
	let agentWasInCatalog: boolean;
	try {
		agentWasInCatalog = await isInDialogbankCatalog(agentId);
	} catch (cause) {
		return { ok: false, status: errorStatus(cause), message: describeError(cause) };
	}
	// An agent outside the catalog is only detached here: it keeps the assignment
	// id, so its conversations would still be attributed to this assignment.
	if (agentWasInCatalog) {
		try {
			const agentTarget = await resolveElevenLabsAgentTargetForAgentId(process.env, agentId);
			const reader = createElevenLabsAgentReader(process.env);
			const writer = createElevenLabsAgentWriter(process.env);
			const existingAgent = await reader.get(agentTarget.agentId, {
				branchId: agentTarget.branchId,
			});
			await removeElevenLabsAgentAssignment(agentTarget, existingAgent, writer);
		} catch (cause) {
			// A deleted remote agent is already detached from the assignment.
			if (!(cause instanceof ElevenLabsError && cause.statusCode === 404)) {
				const message = describeError(cause);
				await db
					.update(assignments)
					.set({ agentConfigurationError: message })
					.where(eq(assignments.id, id));
				return { ok: false, status: errorStatus(cause), message };
			}
		}
	}

	await db
		.update(assignments)
		.set({
			elevenLabsAgentId: null,
			elevenLabsAgentVersionId: null,
			agentConfiguredAt: null,
			agentConfigurationError: null,
		})
		.where(and(eq(assignments.id, id), eq(assignments.elevenLabsAgentId, agentId)));
	return { ok: true, agentWasInCatalog };
}

export const actions = withAuthenticatedActions<Parameters<Actions["save"]>[0], Actions>({
	save: async (event) => {
		const id = parseAssignmentId(event.params.id);
		const formData = await event.request.formData();
		const invalid = await saveAssignmentForm(event.locals.db, id, formData);
		if (invalid) return invalid;

		const agentId = await loadAssignmentAgentId(event.locals.db, id);
		if (!agentId) {
			return { success: true, action: "save", message: "Einsatz gespeichert." };
		}

		const configured = await configureAssignmentAgent(event.locals.db, id, agentId);
		if (!configured.ok) {
			return fail(configured.status, {
				action: "save",
				message: `Einsatz gespeichert, aber der Agent konnte nicht aktualisiert werden: ${configured.message}`,
			});
		}
		return {
			success: true,
			action: "save",
			message: "Einsatz gespeichert und Agent aktualisiert.",
		};
	},

	connectAgent: async (event) => {
		const id = parseAssignmentId(event.params.id);
		const formData = await event.request.formData();
		const invalid = await saveAssignmentForm(event.locals.db, id, formData);
		if (invalid) return invalid;

		const selectedAgentId = parseElevenLabsAgentId(formData);
		const currentAgentId = await loadAssignmentAgentId(event.locals.db, id);

		if (!selectedAgentId) {
			if (!currentAgentId) {
				return fail(400, {
					action: "connectAgent",
					message: "Dem Einsatz ist kein Agent zugewiesen.",
				});
			}
			const disconnected = await disconnectAssignmentAgent(event.locals.db, id, currentAgentId);
			if (!disconnected.ok) {
				return fail(disconnected.status, {
					action: "connectAgent",
					message: `Einsatz gespeichert, aber der Agent konnte nicht getrennt werden: ${disconnected.message}`,
				});
			}
			return {
				success: true,
				action: "connectAgent",
				message: disconnected.agentWasInCatalog
					? "Einsatz gespeichert und Agent getrennt."
					: `Einsatz gespeichert und Agent getrennt. ${notInCatalogMessage()} Er wurde in ElevenLabs deshalb nicht verändert und enthält weiterhin die ID dieses Einsatzes.`,
			};
		}

		if (currentAgentId && currentAgentId !== selectedAgentId) {
			return fail(409, {
				action: "connectAgent",
				message: "Der aktuelle Agent muss zuerst getrennt werden.",
			});
		}
		const [agentOwner] = await event.locals.db
			.select({ assignmentId: assignments.id })
			.from(assignments)
			.where(eq(assignments.elevenLabsAgentId, selectedAgentId))
			.limit(1);
		if (agentOwner && agentOwner.assignmentId !== id) {
			return fail(409, {
				action: "connectAgent",
				message: "Dieser Agent ist bereits einem anderen Einsatz zugewiesen.",
			});
		}

		let selectedAgentIsInCatalog: boolean;
		try {
			selectedAgentIsInCatalog = await isInDialogbankCatalog(selectedAgentId);
		} catch (cause) {
			return fail(errorStatus(cause), {
				action: "connectAgent",
				message: `Agentenkatalog konnte nicht geprüft werden: ${describeError(cause)}`,
			});
		}
		if (!selectedAgentIsInCatalog) {
			return fail(400, { action: "connectAgent", message: notInCatalogMessage() });
		}

		const newlyClaimedAgent = !currentAgentId;
		if (newlyClaimedAgent) {
			try {
				const claimedAssignments = await event.locals.db
					.update(assignments)
					.set({
						elevenLabsAgentId: selectedAgentId,
						agentConfigurationError: null,
					})
					.where(and(eq(assignments.id, id), isNull(assignments.elevenLabsAgentId)))
					.returning();
				if (claimedAssignments.length === 0) {
					return fail(409, {
						action: "connectAgent",
						message: "Der Einsatz wurde zwischenzeitlich geändert. Bitte laden Sie die Seite neu.",
					});
				}
			} catch (cause) {
				if (!isUniqueConstraintViolation(cause)) throw cause;
				return fail(409, {
					action: "connectAgent",
					message: "Dieser Agent ist bereits einem anderen Einsatz zugewiesen.",
				});
			}
		}

		const configured = await configureAssignmentAgent(event.locals.db, id, selectedAgentId);
		if (!configured.ok) {
			return fail(configured.status, {
				action: "connectAgent",
				message: `Einsatz gespeichert, aber der Agent konnte nicht konfiguriert werden: ${configured.message}`,
			});
		}
		return {
			success: true,
			action: "connectAgent",
			message: newlyClaimedAgent
				? "Einsatz gespeichert und Agent verbunden."
				: "Einsatz gespeichert und Agent neu konfiguriert.",
		};
	},
});
