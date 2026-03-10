import { db } from '$lib/server/db';
import { answers, conversations } from '$lib/server/db/schema';
import { parseElevenLabsWebhook } from './parsing';
import { consola } from 'consola';

/**
 * Handles the storage of ElevenLabs post-call transcription data.
 */
export async function processElevenLabsPostCall(payload: unknown): Promise<{
	conversationId: string;
	answerCount: number;
}> {
	const data = parseElevenLabsWebhook(payload);

	try {
		// Use db.batch to run both inserts in a single HTTP request (atomic transaction on server)
		if (data.answers.length > 0) {
			const answerRecords = data.answers.map((a) => ({
				conversationId: data.conversation.conversationId,
				...a
			}));

			await db.batch([
				db.insert(conversations).values(data.conversation),
				db.insert(answers).values(answerRecords)
			]);
		} else {
			await db.insert(conversations).values(data.conversation);
		}

		consola.success(
			`Conversation ${data.conversation.conversationId} processed: ${data.answers.length} answers stored`
		);

		return {
			conversationId: data.conversation.conversationId,
			answerCount: data.answers.length
		};
	} catch (e) {
		consola.error(`Failed to store ElevenLabs data for ${data.conversation.conversationId}`, e);
		throw e;
	}
}
