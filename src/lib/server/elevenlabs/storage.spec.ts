import { describe, it, expect, vi, type Mock } from 'vitest';
import { processElevenLabsPostCall } from './storage';
import { samplePayload1, samplePayload2 } from './storage.spec/data';
import { answers } from '$lib/server/db/schema';

// Mock database
const mockValues = vi.fn().mockReturnThis();

vi.mock('$lib/server/db', () => ({
	db: {
		insert: vi.fn()
	}
}));

import { db } from '$lib/server/db';

describe('ElevenLabs Storage', () => {
	it('processes payload with no results', async () => {
		const result = await processElevenLabsPostCall(samplePayload1);

		expect(result.answerCount).toBe(0);
		expect(db.insert).not.toHaveBeenCalled();
	});

	it('processes payload and inserts records into answers table', async () => {
		(db.insert as Mock).mockReturnValue({ values: mockValues });

		const result = await processElevenLabsPostCall(samplePayload2);

		expect(result.answerCount).toBe(5);
		expect(db.insert).toHaveBeenCalledWith(answers);

		const insertedValues = mockValues.mock.calls[0][0];
		expect(insertedValues).toHaveLength(5);

		const firstRecord = insertedValues[0];
		expect(firstRecord).toMatchObject({
			agentId: samplePayload2.data.agent_id,
			conversationId: samplePayload2.data.conversation_id,
			dataCollectionId: 'Vorname',
			value: 'Heinz',
			rationale: expect.stringContaining('Heinz')
		});
	});
});
