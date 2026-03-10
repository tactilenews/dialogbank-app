import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processElevenLabsPostCall } from './storage';
import { samplePayload1, samplePayload2 } from './storage.spec/data';
import { answers, conversations } from '$lib/server/db/schema';
import type { Mock } from 'vitest';

// Helper to create a chainable mock for drizzle insert
const createInsertMock = () => {
	const mock = {
		values: vi.fn().mockReturnThis()
	};
	return mock;
};

const mockInsertConversations = createInsertMock();
const mockInsertAnswers = createInsertMock();

vi.mock('$lib/server/db', () => {
	const mockDb = {
		insert: vi.fn((table) => {
			if (table && 'agentId' in table) return mockInsertConversations;
			if (table && 'dataCollectionId' in table) return mockInsertAnswers;
			return { values: vi.fn().mockReturnThis() };
		}),
		batch: vi.fn().mockResolvedValue([])
	};
	return { db: mockDb };
});

import { db } from '$lib/server/db';

describe('ElevenLabs Storage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(db.batch as Mock).mockResolvedValue([]);
		mockInsertConversations.values.mockReturnThis();
		mockInsertAnswers.values.mockReturnThis();
	});

	it('processes payload with no results', async () => {
		const resultPromise = processElevenLabsPostCall(samplePayload1);
		await expect(resultPromise).resolves.toEqual(
			expect.objectContaining({
				answerCount: 0
			})
		);

		expect(db.insert).toHaveBeenCalledWith(conversations);
		expect(mockInsertConversations.values).toHaveBeenCalled();
		expect(db.batch).not.toHaveBeenCalled();
	});

	it('processes latest payload format (English IDs)', async () => {
		const resultPromise = processElevenLabsPostCall(samplePayload2);
		await expect(resultPromise).resolves.toEqual(
			expect.objectContaining({
				answerCount: 1
			})
		);

		// Check that batch was called
		expect(db.batch).toHaveBeenCalled();
		const batchQueries = (db.batch as Mock).mock.calls[0][0];
		expect(batchQueries).toHaveLength(2);

		// Verify that inserts were called for both tables
		expect(db.insert).toHaveBeenCalledWith(conversations);
		expect(db.insert).toHaveBeenCalledWith(answers);

		// Verify values were passed to conversations insert
		expect(mockInsertConversations.values).toHaveBeenCalledWith(
			expect.objectContaining({
				agentId: samplePayload2.data.agent_id,
				conversationId: samplePayload2.data.conversation_id,
				firstName: 'Fritz',
				lastName: 'Haarmaan',
				age: 49,
				publicationAllowed: true,
				callSuccessful: 'success',
				summary: expect.stringContaining('The conversation began')
			})
		);

		// Verify values were passed to answers insert
		expect(mockInsertAnswers.values).toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({
					conversationId: samplePayload2.data.conversation_id,
					dataCollectionId: 'answer_1',
					value: 'Sachsen'
				})
			])
		);
	});
});
