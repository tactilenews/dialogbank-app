import { env } from '$env/dynamic/private';
import { error, type RequestEvent } from '@sveltejs/kit';
import crypto from 'node:crypto';

export function verifyElevenLabsSignature(body: string, header: string): boolean {
	const webhookSecret = env.ELEVENLABS_WEBHOOK_SECRET;

	if (!webhookSecret) {
		throw new Error('ELEVENLABS_WEBHOOK_SECRET is not set');
	}

	const parts = header.split(',');
	const tPart = parts.find((p) => p.startsWith('t='));
	const vPart = parts.find((p) => p.startsWith('v0='));

	if (!tPart || !vPart || !vPart.startsWith('v0=')) return false;

	const timestamp = tPart.split('=')[1];
	const signature = vPart.split('=')[1];

	const signedPayload = `${timestamp}.${body}`;
	const expectedSignature = crypto
		.createHmac('sha256', webhookSecret)
		.update(signedPayload)
		.digest('hex');

	try {
		return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
	} catch {
		return false;
	}
}

/**
 * Higher-order function to protect ElevenLabs webhook endpoints
 */
export function withElevenLabsVerification(handler: (event: RequestEvent) => Promise<Response>) {
	return async (event: RequestEvent) => {
		const signatureHeader = event.request.headers.get('ElevenLabs-Signature');
		if (!signatureHeader) {
			throw error(401, 'Missing signature');
		}

		// We need to clone the request to read the body without consuming it for the actual handler
		const body = await event.request.clone().text();
		const isVerified = verifyElevenLabsSignature(body, signatureHeader);

		if (!isVerified) {
			throw error(401, 'Invalid signature');
		}

		return handler(event);
	};
}
