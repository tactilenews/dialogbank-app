import { relations } from "drizzle-orm";
import {
	boolean,
	integer,
	pgTable,
	primaryKey,
	serial,
	text,
	timestamp,
	unique,
} from "drizzle-orm/pg-core";

export const assignments = pgTable("assignments", {
	id: serial("id").primaryKey(),
	name: text("name").notNull(),
	location: text("location"),
	client: text("client"),
	promptSupplement: text("prompt_supplement"),
	isActive: boolean("is_active").notNull().default(false),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull(),
});

export const assignmentsRelations = relations(assignments, ({ many }) => ({
	questions: many(questions),
	conversations: many(conversations),
}));

export const questions = pgTable("questions", {
	id: serial("id").primaryKey(),
	assignmentId: integer("assignment_id")
		.notNull()
		.references(() => assignments.id, { onDelete: "cascade" }),
	text: text("text").notNull(),
	displayOrder: integer("display_order").notNull().default(0),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull(),
});

export const questionClassifications = pgTable(
	"question_classifications",
	{
		questionId: integer("question_id")
			.notNull()
			.references(() => questions.id, { onDelete: "cascade" }),
		classificationId: integer("classification_id")
			.notNull()
			.references(() => classifications.id, { onDelete: "cascade" }),
	},
	(table) => [primaryKey({ columns: [table.questionId, table.classificationId] })],
);

export const questionsRelations = relations(questions, ({ one, many }) => ({
	assignment: one(assignments, {
		fields: [questions.assignmentId],
		references: [assignments.id],
	}),
	questionClassifications: many(questionClassifications),
}));

export const questionClassificationsRelations = relations(questionClassifications, ({ one }) => ({
	question: one(questions, {
		fields: [questionClassifications.questionId],
		references: [questions.id],
	}),
	classification: one(classifications, {
		fields: [questionClassifications.classificationId],
		references: [classifications.id],
	}),
}));

export const conversations = pgTable("conversations", {
	conversationId: text("conversation_id").primaryKey(),
	agentId: text("agent_id").notNull(),
	assignmentId: integer("assignment_id")
		.notNull()
		.references(() => assignments.id),
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

export const conversationsRelations = relations(conversations, ({ many, one }) => ({
	answers: many(answers),
	assignment: one(assignments, {
		fields: [conversations.assignmentId],
		references: [assignments.id],
	}),
}));

export const classifications = pgTable(
	"classifications",
	{
		id: serial("id").primaryKey(),
		key: text("key").notNull(),
		label: text("label").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [unique("classifications_key_unique").on(table.key)],
);

export const answers = pgTable("answers", {
	id: serial("id").primaryKey(),
	conversationId: text("conversation_id")
		.notNull()
		.references(() => conversations.conversationId, { onDelete: "cascade" }),
	dataCollectionId: text("data_collection_id").notNull(),
	value: text("value"),
	rationale: text("rationale"),
	classificationId: integer("classification_id").references(() => classifications.id, {
		onDelete: "set null",
	}),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull(),
});

export const classificationsRelations = relations(classifications, ({ many }) => ({
	answers: many(answers),
	questionClassifications: many(questionClassifications),
}));

export const answersRelations = relations(answers, ({ one }) => ({
	conversation: one(conversations, {
		fields: [answers.conversationId],
		references: [conversations.conversationId],
	}),
	classificationRecord: one(classifications, {
		fields: [answers.classificationId],
		references: [classifications.id],
	}),
}));

export * from "./auth.schema";
