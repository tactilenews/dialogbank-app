CREATE TABLE "answers" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"conversation_id" text NOT NULL,
	"data_collection_id" text NOT NULL,
	"value" text,
	"rationale" text
);
