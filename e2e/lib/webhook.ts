import crypto from "node:crypto";

/**
 * Creates an ElevenLabs HMAC-SHA256 signature header for testing.
 * The secret must match ELEVENLABS_WEBHOOK_SECRET in the test environment.
 */
export function createElevenLabsSignature(body: string): string {
	// This secret must be added to Infisical as ELEVENLABS_WEBHOOK_SECRET for the test environment
	const TEST_WEBHOOK_SECRET = "webhook-test-secret-12345";
	const timestamp = Math.floor(Date.now() / 1000).toString();
	const signedPayload = `${timestamp}.${body}`;
	const signature = crypto
		.createHmac("sha256", TEST_WEBHOOK_SECRET)
		.update(signedPayload)
		.digest("hex");
	return `t=${timestamp},v0=${signature}`;
}
