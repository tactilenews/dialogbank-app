import { consola } from "consola";
import { db, dbAtomic } from "$lib/server/db";
import { answers, conversations } from "$lib/server/db/schema";
import { parseElevenLabsWebhook } from "./parsing";

/**
 * Handles the storage of ElevenLabs post-call transcription data.
 */
export async function processElevenLabsPostCall(payload: unknown): Promise<{
	conversationId: string;
	answerCount: number;
}> {
	const data = parseElevenLabsWebhook(payload);

	try {
		// Use dbAtomic to run both inserts in the best available atomic mode
		if (data.answers.length > 0) {
			const answerRecords = data.answers.map((a) => ({
				conversationId: data.conversation.conversationId,
				...a,
			}));

			await dbAtomic((client) => [
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
