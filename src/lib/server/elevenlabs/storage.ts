import { consola } from "consola";
import { eq } from "drizzle-orm";
import type { DbClient } from "$lib/server/db";
import { dbAtomic } from "$lib/server/db";
import { answers, classifications, conversations } from "$lib/server/db/schema";
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

/**
 * Handles the storage of ElevenLabs post-call transcription data.
 */
export async function processElevenLabsPostCall({ db, payload }: StorageInput): Promise<{
	conversationId: string;
	answerCount: number;
}> {
	const data = parseElevenLabsWebhook(payload);

	try {
		// Use dbAtomic to run both inserts in the best available atomic mode
		if (data.answers.length > 0) {
			const answerRecords = await Promise.all(
				data.answers.map(async ({ classificationKey, ...answerData }) => {
					const classificationId = classificationKey
						? await findOrCreateClassification(db, classificationKey)
						: null;
					return {
						conversationId: data.conversation.conversationId,
						...answerData,
						classificationId,
					};
				}),
			);

			await dbAtomic(db, (client) => [
				client.insert(conversations).values(data.conversation),
				client.insert(answers).values(answerRecords),
			]);
		} else {
			await db.insert(conversations).values(data.conversation);
		}

		consola.success(
			`Conversation ${data.conversation.conversationId} processed: ${data.answers.length} answers stored`,
		);

		return {
			conversationId: data.conversation.conversationId,
			answerCount: data.answers.length,
		};
	} catch (e) {
		consola.error(`Failed to store ElevenLabs data for ${data.conversation.conversationId}`, e);
		throw e;
	}
}
