import { pgTable, serial, text } from 'drizzle-orm/pg-core';

export const answers = pgTable('answers', {
	id: serial('id').primaryKey(),
	agentId: text('agent_id').notNull(),
	conversationId: text('conversation_id').notNull(),
	dataCollectionId: text('data_collection_id').notNull(),
	value: text('value'),
	rationale: text('rationale')
});

export * from './auth.schema';
