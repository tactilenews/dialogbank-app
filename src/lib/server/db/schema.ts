import { relations } from "drizzle-orm";
import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const conversations = pgTable("conversations", {
	conversationId: text("conversation_id").primaryKey(),
	agentId: text("agent_id").notNull(),
	firstName: text("first_name"),
	lastName: text("last_name"),
	age: integer("age"),
	publicationAllowed: boolean("publication_allowed"),
	callSuccessful: text("call_successful"),
	summary: text("summary"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull(),
});

export const conversationsRelations = relations(conversations, ({ many }) => ({
	answers: many(answers),
}));

export const answers = pgTable("answers", {
	id: serial("id").primaryKey(),
	conversationId: text("conversation_id")
		.notNull()
		.references(() => conversations.conversationId, { onDelete: "cascade" }),
	dataCollectionId: text("data_collection_id").notNull(),
	value: text("value"),
	rationale: text("rationale"),
	classification: text("classification"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull(),
});

export const answersRelations = relations(answers, ({ one }) => ({
	conversation: one(conversations, {
		fields: [answers.conversationId],
		references: [conversations.conversationId],
	}),
}));

export * from "./auth.schema";
