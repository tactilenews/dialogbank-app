import crypto from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { verifyElevenLabsSignature } from "./signature";

const env = vi.hoisted((): { ELEVENLABS_WEBHOOK_SECRET?: string } => ({}));
vi.mock("$env/dynamic/private", () => ({ env }));

function sign(secret: string, body: string) {
	const timestamp = Math.floor(Date.now() / 1000).toString();
	const signature = crypto
		.createHmac("sha256", secret)
		.update(`${timestamp}.${body}`)
		.digest("hex");
	return `t=${timestamp},v0=${signature}`;
}

describe("verifyElevenLabsSignature", () => {
	it("accepts a body signed with the configured secret", () => {
		env.ELEVENLABS_WEBHOOK_SECRET = "wsec_test";

		expect(verifyElevenLabsSignature("{}", sign("wsec_test", "{}"))).toBe(true);
	});

	it.each([
		["missing", undefined],
		["the preview placeholder", "unset"],
	])("refuses to verify anything when the secret is %s", (_, secret) => {
		env.ELEVENLABS_WEBHOOK_SECRET = secret;

		expect(() => verifyElevenLabsSignature("{}", sign("unset", "{}"))).toThrow(
			"ELEVENLABS_WEBHOOK_SECRET is not set",
		);
	});
});
