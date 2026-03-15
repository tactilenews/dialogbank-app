import * as Sentry from "@sentry/sveltekit";
import { error, json } from "@sveltejs/kit";
import { consola } from "consola";
import { withElevenLabsVerification } from "$lib/server/elevenlabs/signature";
import { processElevenLabsPostCall } from "$lib/server/elevenlabs/storage";
import type { LocalsSubset, RequestHandlerWithLocals } from "$lib/server/kit";
import type { RequestHandler } from "./$types";

type PostCallLocals = LocalsSubset<"db">;

const handlePostCall: RequestHandlerWithLocals<PostCallLocals> = async ({ request, locals }) => {
	const body = await request.text();

	let payload: unknown;
	try {
		payload = JSON.parse(body);
	} catch {
		throw error(400, "Invalid JSON");
	}

	const typedPayload = payload as { type: string };
	consola.info("Received ElevenLabs webhook:", typedPayload.type);
	Sentry.logger.info("[elevenlabs webhook payload]", typedPayload);

	try {
		await processElevenLabsPostCall({ db: locals.db, payload });
	} catch (e) {
		// parseElevenLabsWebhook might throw ZodError, or db might throw
		consola.error(e);
		throw error(500, "Failed to process webhook");
	}

	return json({ success: true });
};

export const POST = withElevenLabsVerification(handlePostCall) satisfies RequestHandler;
