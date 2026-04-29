CREATE TABLE "assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"location" text,
	"client" text,
	"prompt_supplement" text,
	"is_active" boolean NOT NULL DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"assignment_id" integer NOT NULL,
	"text" text NOT NULL,
	"display_order" integer NOT NULL DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "question_classifications" (
	"question_id" integer NOT NULL,
	"classification_id" integer NOT NULL,
	CONSTRAINT "question_classifications_question_id_classification_id_pk" PRIMARY KEY("question_id","classification_id")
);--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_classifications" ADD CONSTRAINT "question_classifications_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_classifications" ADD CONSTRAINT "question_classifications_classification_id_classifications_id_fk" FOREIGN KEY ("classification_id") REFERENCES "public"."classifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "assignment_id" integer;--> statement-breakpoint
INSERT INTO "assignments" ("name", "is_active") VALUES ('Standard', true);--> statement-breakpoint
UPDATE "conversations" SET "assignment_id" = (SELECT "id" FROM "assignments" WHERE "name" = 'Standard' LIMIT 1);--> statement-breakpoint
ALTER TABLE "conversations" ALTER COLUMN "assignment_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE no action ON UPDATE no action;
