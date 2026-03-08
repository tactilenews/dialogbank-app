import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { withElevenLabsVerification } from '$lib/server/elevenlabs/signature';
import { consola } from 'consola';
import { processElevenLabsPostCall } from '$lib/server/elevenlabs/storage';

export const POST: RequestHandler = withElevenLabsVerification(async ({ request }) => {
	const body = await request.text();

	let payload;
	try {
		payload = JSON.parse(body);
	} catch {
		throw error(400, 'Invalid JSON');
	}

	consola.info('Received ElevenLabs webhook:', payload.type);

	try {
		await processElevenLabsPostCall(payload);
	} catch (e) {
		// parseElevenLabsWebhook might throw ZodError, or db might throw
		consola.error(e);
		throw error(500, 'Failed to process webhook');
	}

	return json({ success: true });
});
