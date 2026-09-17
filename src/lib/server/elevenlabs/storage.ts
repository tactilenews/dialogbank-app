import * as Sentry from "@sentry/sveltekit";
import { consola } from "consola";
import { eq } from "drizzle-orm";
import type { DbClient } from "$lib/server/db";
import { dbAtomic } from "$lib/server/db";
import { answers, assignments, classifications, conversations } from "$lib/server/db/schema";
import { parseElevenLabsWebhook } from "./parsing";

type StorageInput = {
	db: DbClient;
	payload: unknown;
};

async function findOrCreateClassification(db: DbClient, key: string): Promise<number> {
	const [existing] = await db
		.select({ id: classifications.id })
		.from(classifications)
		.where(eq(classifications.key, key));

	if (existing) return existing.id;

	const [created] = await db.insert(classifications).values({ key, label: key }).returning();
	return created.id;
}

export async function processElevenLabsPostCall({ db, payload }: StorageInput): Promise<{
	conversationId: string;
	answerCount: number;
} | null> {
	const data = parseElevenLabsWebhook(payload);
	const conversationBase = data.conversation;

	let assignmentId: number | null = null;
	if (data.assignmentId !== null) {
		const [assignment] = await db
			.select({ id: assignments.id })
			.from(assignments)
			.where(eq(assignments.id, data.assignmentId))
			.limit(1);
		assignmentId = assignment?.id ?? null;
	} else {
		const matches = await db
			.select({ id: assignments.id })
			.from(assignments)
			.where(eq(assignments.elevenLabsAgentId, conversationBase.agentId))
			.limit(2);
		assignmentId = matches.length === 1 ? matches[0].id : null;
	}

	if (assignmentId === null) {
		Sentry.captureMessage(
			"Conversation assignment could not be resolved; conversation not stored",
			{
				level: "error",
				extra: {
					conversationId: conversationBase.conversationId,
					agentId: conversationBase.agentId,
					assignmentId: data.assignmentId,
				},
			},
		);
		consola.error(
			`Assignment for conversation ${conversationBase.conversationId} could not be resolved`,
		);
		return null;
	}

	try {
		// Use dbAtomic to run both inserts in the best available atomic mode
		if (data.answers.length > 0) {
			const classificationIdByKey = new Map<string, number>();
			const classificationKeys = [
				...new Set(data.answers.flatMap((answer) => answer.classificationKey ?? [])),
			];

			for (const classificationKey of classificationKeys) {
				classificationIdByKey.set(
					classificationKey,
					await findOrCreateClassification(db, classificationKey),
				);
			}

			const answerRecords = data.answers.map(({ classificationKey, ...answerData }) => ({
				conversationId: conversationBase.conversationId,
				...answerData,
				classificationId: classificationKey
					? (classificationIdByKey.get(classificationKey) ?? null)
					: null,
			}));

			await dbAtomic(db, (client) => [
				client.insert(conversations).values({ ...conversationBase, assignmentId }),
				client.insert(answers).values(answerRecords),
			]);
		} else {
			await db.insert(conversations).values({ ...conversationBase, assignmentId });
		}

		consola.success(
			`Conversation ${conversationBase.conversationId} processed: ${data.answers.length} answers stored`,
		);

		return {
			conversationId: conversationBase.conversationId,
			answerCount: data.answers.length,
		};
	} catch (e) {
		consola.error(`Failed to store ElevenLabs data for ${conversationBase.conversationId}`, e);
		throw e;
	}
}
