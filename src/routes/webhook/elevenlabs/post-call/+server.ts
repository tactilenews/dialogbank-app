import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { withElevenLabsVerification } from '$lib/server/elevenlabs';
import { consola } from 'consola';

export const POST: RequestHandler = withElevenLabsVerification(async ({ request }) => {
	const body = await request.text();

	let payload;
	try {
		payload = JSON.parse(body);
	} catch {
		throw error(400, 'Invalid JSON');
	}

	consola.info('Received ElevenLabs webhook:', payload.type);

	if (payload.type === 'post_call_transcription') {
		const { data } = payload;
		consola.success(`Conversation ${data.conversation_id} finished for agent ${data.agent_id}`);
		// TODO: Store in database when schema is ready
	}

	return json({ success: true });
});
