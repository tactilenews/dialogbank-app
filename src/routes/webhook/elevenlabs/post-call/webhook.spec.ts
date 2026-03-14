import crypto from "node:crypto";
import { vi } from "vitest";
import { processElevenLabsPostCall } from "$lib/server/elevenlabs/storage";
import { createRequestEvent, describe, it } from "$lib/server/test/fixtures";
import { POST } from "./+server";

vi.mock("$env/dynamic/private", () => ({
	env: {
		ELEVENLABS_WEBHOOK_SECRET: "test-secret",
	},
}));

vi.mock("$lib/server/elevenlabs/storage", () => ({
	processElevenLabsPostCall: vi.fn(),
}));

describe("ElevenLabs Webhook", () => {
	const secret = "test-secret";
	const timestamp = Math.floor(Date.now() / 1000).toString();
	const body = JSON.stringify({
		type: "post_call_transcription",
		data: {
			conversation_id: "conv-123",
			agent_id: "agent-456",
		},
	});

	const signature = crypto
		.createHmac("sha256", secret)
		.update(`${timestamp}.${body}`)
		.digest("hex");

	const validHeader = `t=${timestamp},v0=${signature}`;
	const url = "http://localhost/webhook/elevenlabs/post-call";

	it("returns 200 and calls processElevenLabsPostCall for a valid payload", async ({
		db,
		auth,
		expect,
		schema,
	}) => {
		const request = new Request(url, {
			method: "POST",
			headers: {
				"ElevenLabs-Signature": validHeader,
				"Content-Type": "application/json",
			},
			body,
		});

		const event = createRequestEvent({
			request,
			locals: { db, schema, auth },
			routeId: "/webhook/elevenlabs/post-call",
		});
		const responsePromise = POST(event);

		await expect(responsePromise).resolves.toBeInstanceOf(Response);
		const response = await responsePromise;
		expect(response.status).toBe(200);

		await expect(response.json()).resolves.toEqual({ success: true });
		expect(processElevenLabsPostCall).toHaveBeenCalledWith({ db, payload: JSON.parse(body) });
	});

	it("throws 401 if signature is missing", async ({ auth, db, expect, schema }) => {
		const request = new Request(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body,
		});

		const event = createRequestEvent({
			request,
			locals: { auth, db, schema },
			routeId: "/webhook/elevenlabs/post-call",
		});
		await expect(POST(event)).rejects.toMatchObject({ status: 401 });
	});

	it("throws 401 for an invalid signature", async ({ auth, db, expect, schema }) => {
		const request = new Request(url, {
			method: "POST",
			headers: {
				"ElevenLabs-Signature": `t=${timestamp},v0=wrong-sig`,
				"Content-Type": "application/json",
			},
			body,
		});

		const event = createRequestEvent({
			request,
			locals: { auth, db, schema },
			routeId: "/webhook/elevenlabs/post-call",
		});
		await expect(POST(event)).rejects.toMatchObject({ status: 401 });
	});

	it("throws 400 for invalid JSON", async ({ auth, db, expect, schema }) => {
		const invalidBody = "invalid-json";
		const invalidSig = crypto
			.createHmac("sha256", secret)
			.update(`${timestamp}.${invalidBody}`)
			.digest("hex");

		const request = new Request(url, {
			method: "POST",
			headers: {
				"ElevenLabs-Signature": `t=${timestamp},v0=${invalidSig}`,
				"Content-Type": "application/json",
			},
			body: invalidBody,
		});

		const event = createRequestEvent({
			request,
			locals: { auth, db, schema },
			routeId: "/webhook/elevenlabs/post-call",
		});
		await expect(POST(event)).rejects.toMatchObject({ status: 400 });
	});
});
