import crypto from "node:crypto";
import { error, type RequestEvent, type RequestHandler } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import type { RequestEventWithLocals } from "$lib/server/kit";

export function verifyElevenLabsSignature(body: string, header: string): boolean {
	const webhookSecret = env.ELEVENLABS_WEBHOOK_SECRET;

	if (!webhookSecret) {
		throw new Error("ELEVENLABS_WEBHOOK_SECRET is not set");
	}

	const parts = header.split(",");
	const tPart = parts.find((p) => p.startsWith("t="));
	const vPart = parts.find((p) => p.startsWith("v0="));

	if (!tPart || !vPart?.startsWith("v0=")) return false;

	const timestamp = tPart.split("=")[1];
	const signature = vPart.split("=")[1];

	const signedPayload = `${timestamp}.${body}`;
	const expectedSignature = crypto
		.createHmac("sha256", webhookSecret)
		.update(signedPayload)
		.digest("hex");

	try {
		return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
	} catch {
		return false;
	}
}

/**
 * Higher-order function to protect ElevenLabs webhook endpoints
 */
export function withElevenLabsVerification<
	Locals extends Partial<App.Locals> = App.Locals,
	RouteId extends RequestEvent["route"]["id"] = RequestEvent["route"]["id"],
>(handler: (event: RequestEventWithLocals<Locals, RouteId>) => ReturnType<RequestHandler>) {
	return async (event: RequestEventWithLocals<Locals, RouteId>) => {
		const signatureHeader = event.request.headers.get("ElevenLabs-Signature");
		if (!signatureHeader) {
			throw error(401, "Missing signature");
		}

		// We need to clone the request to read the body without consuming it for the actual handler
		const body = await event.request.clone().text();
		const isVerified = verifyElevenLabsSignature(body, signatureHeader);

		if (!isVerified) {
			throw error(401, "Invalid signature");
		}

		return handler(event) as ReturnType<RequestHandler>;
	};
}
