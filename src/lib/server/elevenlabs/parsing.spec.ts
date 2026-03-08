import { describe, it, expect } from 'vitest';
import { parseElevenLabsWebhook } from './parsing';
import { ZodError } from 'zod';
import { samplePayload1, samplePayload2 } from './parsing.spec/data';

describe('ElevenLabs Webhook Parser', () => {
	const mockPayload = {
		type: 'post_call_transcription',
		data: {
			conversation_id: 'conv-123',
			agent_id: 'agent-456',
			analysis: {
				transcript_summary: 'Summary',
				data_collection_results: {
					order_type: {
						data_collection_id: 'order_type',
						value: 'pizza',
						rationale: 'User said pizza'
					}
				},
				call_successful: true
			}
		}
	};

	describe('parseElevenLabsWebhook', () => {
		it('returns strongly typed data from the payload', () => {
			const data = parseElevenLabsWebhook(mockPayload);

			expect(data.conversationId).toBe('conv-123');
			expect(data.agentId).toBe('agent-456');
			expect(data.isSuccess).toBe(true);
			expect(data.summary).toBe('Summary');

			expect(data.dataCollectionResults).toHaveLength(1);
			const result = data.dataCollectionResults[0];
			expect(result.data_collection_id).toBe('order_type');
			expect(result.value).toBe('pizza');
			expect(result.rationale).toBe('User said pizza');
		});

		it('throws ZodError if payload is invalid', () => {
			const invalidPayload = { type: 'wrong_type' };
			expect(() => parseElevenLabsWebhook(invalidPayload)).toThrow(ZodError);
		});

		it('returns an empty array if data_collection_results is empty', () => {
			const emptyPayload = {
				...mockPayload,
				data: {
					...mockPayload.data,
					analysis: {
						...mockPayload.data.analysis,
						data_collection_results: {}
					}
				}
			};
			const { dataCollectionResults } = parseElevenLabsWebhook(emptyPayload);
			expect(dataCollectionResults).toHaveLength(0);
		});

		it('parses real sample data (samplePayload1 - empty results)', () => {
			const data = parseElevenLabsWebhook(samplePayload1);

			expect(data.conversationId).toBe('conv_4401kjbexa6tfnz97e45sy0666d9');
			expect(data.dataCollectionResults).toHaveLength(0);
		});

		it('parses real sample data (samplePayload2 - with detailed records)', () => {
			const data = parseElevenLabsWebhook(samplePayload2);

			expect(data.conversationId).toBe('conv_2201kjqpnmwmfmvb42nam7v1ghrw');
			expect(data.dataCollectionResults).toHaveLength(5);

			const vorname = data.dataCollectionResults.find((r) => r.data_collection_id === 'Vorname');
			expect(vorname).toBeDefined();
			expect(vorname?.value).toBe('Heinz');
			expect(vorname?.data_collection_id).toBe('Vorname');
			expect(vorname?.rationale).toContain('Heinz');

			const zitat = data.dataCollectionResults.find(
				(r) => r.data_collection_id === 'Zitat-Erlaubnis'
			);
			expect(zitat?.value).toBe(false);
		});
	});
});
