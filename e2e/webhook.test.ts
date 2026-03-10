import { expect, test as base } from '@playwright/test';
import crypto from 'node:crypto';
import { db as dbInstance, schema } from './lib/db';
import * as seed from 'drizzle-seed';

/**
 * Creates an ElevenLabs HMAC-SHA256 signature header for testing.
 */
function createElevenLabsSignature(body: string): string {
	// This secret must be added to Infisical as ELEVENLABS_WEBHOOK_SECRET for the test environment
	const TEST_WEBHOOK_SECRET = 'webhook-test-secret-12345';
	const timestamp = Math.floor(Date.now() / 1000).toString();
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
				conversation_id: 'e2e-conv-fritz',
				agent_id: 'e2e-agent-fritz',
				analysis: {
					transcript_summary: 'Fritz interview summary',
					data_collection_results: {
						first_name: {
							data_collection_id: 'first_name',
							value: 'Fritz',
							rationale: 'Said Fritz'
						},
						last_name: {
							data_collection_id: 'last_name',
							value: 'Haarmaan',
							rationale: 'Said Haarmaan'
						},
						age: {
							data_collection_id: 'age',
							value: 49,
							rationale: 'Said 49'
						},
						publication_allowed: {
							data_collection_id: 'publication_allowed',
							value: true,
							rationale: 'Agreed'
						},
						favorite_color: {
							data_collection_id: 'favorite_color',
							value: 'blue',
							rationale: 'Said blue'
						}
					},
					call_successful: 'success'
				}
			}
		};

		const body = JSON.stringify(payload);
		const signatureHeader = createElevenLabsSignature(body);

		const response = await request.post('/webhook/elevenlabs/post-call', {
			data: body,
			headers: {
				'Content-Type': 'application/json',
				'ElevenLabs-Signature': signatureHeader
			}
		});

		await expect(response.json()).resolves.toEqual({ success: true });

		// Verify database records
		const storedConversation = await db.query.conversations.findFirst({
			where: (conv, { eq }) => eq(conv.conversationId, 'e2e-conv-fritz')
		});

		expect(storedConversation).toBeDefined();
		if (!storedConversation) {
			throw new Error('storedConversation is undefined');
		}
		expect(storedConversation).toMatchObject({
			agentId: 'e2e-agent-fritz',
			conversationId: 'e2e-conv-fritz',
			firstName: 'Fritz',
			lastName: 'Haarmaan',
			age: 49,
			publicationAllowed: true,
			callSuccessful: 'success',
			summary: 'Fritz interview summary'
		});

		const storedAnswers = await db.query.answers.findMany({
			where: (answers, { eq }) => eq(answers.conversationId, storedConversation.conversationId)
		});

		expect(storedAnswers).toHaveLength(1);
		expect(storedAnswers[0]).toMatchObject({
			dataCollectionId: 'favorite_color',
			value: 'blue',
			rationale: 'Said blue'
		});
	});
});
