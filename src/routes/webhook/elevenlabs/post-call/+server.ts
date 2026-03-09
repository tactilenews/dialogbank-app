import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { withElevenLabsVerification } from '$lib/server/elevenlabs/signature';
import { consola } from 'consola';
import { processElevenLabsPostCall } from '$lib/server/elevenlabs/storage';
import * as Sentry from '@sentry/sveltekit';

export const POST: RequestHandler = withElevenLabsVerification(async ({ request }) => {
	const body = await request.text();

	let payload;
	try {
		payload = JSON.parse(body);
	} catch {
		throw error(400, 'Invalid JSON');
	}

	consola.info('Received ElevenLabs webhook:', payload.type);
	Sentry.logger.info('[elevenlabs webhook payload]', payload);

	try {
		await processElevenLabsPostCall(payload);
	} catch (e) {
		// parseElevenLabsWebhook might throw ZodError, or db might throw
		consola.error(e);
		throw error(500, 'Failed to process webhook');
	}

	return json({ success: true });
});
