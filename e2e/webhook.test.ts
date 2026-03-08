import { expect, test as base } from '@playwright/test';
import crypto from 'node:crypto';
import { db as dbInstance, schema } from './lib/db';
import * as seed from 'drizzle-seed';

/**
 * Creates an ElevenLabs HMAC-SHA256 signature header for testing.
 */
function createElevenLabsSignature(body: string, timestamp: string): string {
	// This secret must be added to Infisical as ELEVENLABS_WEBHOOK_SECRET for the test environment
	const TEST_WEBHOOK_SECRET = 'webhook-test-secret-12345';
	const signedPayload = `${timestamp}.${body}`;
	const signature = crypto
		.createHmac('sha256', TEST_WEBHOOK_SECRET)
		.update(signedPayload)
		.digest('hex');
	return `t=${timestamp},v0=${signature}`;
}

// Extend base test to include a database reset fixture
const test = base.extend<{ db: typeof dbInstance }>({
	// eslint-disable-next-line no-empty-pattern
	db: async ({}, use) => {
		await seed.reset(dbInstance, schema);
		await use(dbInstance);
	}
});

test.describe('ElevenLabs Webhook E2E', () => {
	test('successfully processes a signed webhook payload and stores answers', async ({
		request,
		db
	}) => {
		const payload = {
			type: 'post_call_transcription',
			data: {
				conversation_id: 'e2e-conv-123',
				agent_id: 'e2e-agent-456',
				analysis: {
					transcript_summary: 'E2E Test Summary',
					data_collection_results: {
						'test-field': {
							data_collection_id: 'test-field',
							value: 'test-value',
							rationale: 'test-rationale'
						}
					},
					call_successful: 'success'
				}
			}
		};

		const body = JSON.stringify(payload);
		const timestamp = Math.floor(Date.now() / 1000).toString();
		const signatureHeader = createElevenLabsSignature(body, timestamp);

		const response = await request.post('/webhook/elevenlabs/post-call', {
			data: body,
			headers: {
				'Content-Type': 'application/json',
				'ElevenLabs-Signature': signatureHeader
			}
		});

		expect(response.ok()).toBe(true);
		await expect(response.json()).resolves.toEqual({ success: true });

		// Verify database records
		const storedAnswers = await db.query.answers.findMany({
			where: (answers, { eq }) => eq(answers.conversationId, 'e2e-conv-123')
		});

		expect(storedAnswers).toHaveLength(1);
		expect(storedAnswers[0]).toMatchObject({
			agentId: 'e2e-agent-456',
			conversationId: 'e2e-conv-123',
			dataCollectionId: 'test-field',
			value: 'test-value',
			rationale: 'test-rationale'
		});
	});
});
