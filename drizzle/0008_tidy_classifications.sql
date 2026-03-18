CREATE TABLE "classifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "classifications_key_unique" UNIQUE("key"),
	CONSTRAINT "classifications_key_format" CHECK ("key" ~ '^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$')
);--> statement-breakpoint
ALTER TABLE "answers" ADD COLUMN "classification_id" integer;--> statement-breakpoint
INSERT INTO "classifications" ("key", "label")
SELECT DISTINCT
	btrim(regexp_replace(trim("classification"), '[^A-Za-z0-9]+', '-', 'g'), '-') AS "key",
	trim("classification") AS "label"
FROM "answers"
WHERE "classification" IS NOT NULL
	AND trim("classification") <> '';--> statement-breakpoint
UPDATE "answers"
SET "classification_id" = "classifications"."id"
FROM "classifications"
WHERE "answers"."classification" IS NOT NULL
	AND trim("answers"."classification") <> ''
	AND "classifications"."key" = btrim(
		regexp_replace(trim("answers"."classification"), '[^A-Za-z0-9]+', '-', 'g'),
		'-'
	);--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_classification_id_classifications_id_fk" FOREIGN KEY ("classification_id") REFERENCES "public"."classifications"("id") ON DELETE set null ON UPDATE no action;
