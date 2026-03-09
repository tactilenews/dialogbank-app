import { pgTable, serial, integer, text } from 'drizzle-orm/pg-core';

export const task = pgTable('task', {
	id: serial('id').primaryKey(),
	title: text('title').notNull(),
	priority: integer('priority').notNull().default(1)
});

export const answers = pgTable('answers', {
	id: serial('id').primaryKey(),
	agentId: text('agent_id').notNull(),
	conversationId: text('conversation_id').notNull(),
	dataCollectionId: text('data_collection_id').notNull(),
	value: text('value'),
	rationale: text('rationale')
});

export * from './auth.schema';
