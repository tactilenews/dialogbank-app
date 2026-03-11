import * as Sentry from "@sentry/sveltekit";
import { error, json } from "@sveltejs/kit";
import { consola } from "consola";
import { withElevenLabsVerification } from "$lib/server/elevenlabs/signature";
import { processElevenLabsPostCall } from "$lib/server/elevenlabs/storage";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = withElevenLabsVerification(async ({ request }) => {
	const body = await request.text();

	// biome-ignore lint/suspicious/noImplicitAnyLet: payload is assigned in try block
	let payload;
	try {
		payload = JSON.parse(body);
	} catch {
		throw error(400, "Invalid JSON");
	}

	consola.info("Received ElevenLabs webhook:", payload.type);
	Sentry.logger.info("[elevenlabs webhook payload]", payload);

	try {
		await processElevenLabsPostCall(payload);
	} catch (e) {
		// parseElevenLabsWebhook might throw ZodError, or db might throw
		consola.error(e);
		throw error(500, "Failed to process webhook");
	}

	return json({ success: true });
});
