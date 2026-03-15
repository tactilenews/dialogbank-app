import crypto from "node:crypto";

/**
 * Creates an ElevenLabs HMAC-SHA256 signature header for testing.
 * The secret must match ELEVENLABS_WEBHOOK_SECRET in the test environment.
 */
export function createElevenLabsSignature(body: string): string {
	const { env } = process;

	if (!env.ELEVENLABS_WEBHOOK_SECRET) {
		throw new Error("ELEVENLABS_WEBHOOK_SECRET is not set");
	}

	const timestamp = Math.floor(Date.now() / 1000).toString();
	const signedPayload = `${timestamp}.${body}`;
	const signature = crypto
		.createHmac("sha256", env.ELEVENLABS_WEBHOOK_SECRET)
		.update(signedPayload)
		.digest("hex");
	return `t=${timestamp},v0=${signature}`;
}
