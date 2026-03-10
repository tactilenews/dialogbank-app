CREATE TABLE "conversations" (
	"conversation_id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"age" integer,
	"publication_allowed" boolean DEFAULT false NOT NULL,
	"call_successful" text,
	"summary" text
);
--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_conversation_id_conversations_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("conversation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answers" DROP COLUMN "agent_id";