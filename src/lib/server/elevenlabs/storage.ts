import { db } from '$lib/server/db';
import { answers } from '$lib/server/db/schema';
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
		if (data.dataCollectionResults.length > 0) {
			const answerRecords = data.dataCollectionResults.map((r) => ({
				agentId: data.agentId,
				conversationId: data.conversationId,
				dataCollectionId: r.data_collection_id,
				value: String(r.value ?? ''),
				rationale: r.rationale
			}));

			await db.insert(answers).values(answerRecords);
		}

		consola.success(
			`Conversation ${data.conversationId} processed: ${data.dataCollectionResults.length} answers stored`
		);

		return {
			conversationId: data.conversationId,
			answerCount: data.dataCollectionResults.length
		};
	} catch (e) {
		consola.error(`Failed to store ElevenLabs data for ${data.conversationId}`, e);
		throw e;
	}
}
