ALTER TABLE "conversations" ALTER COLUMN "publication_allowed" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "conversations" ALTER COLUMN "publication_allowed" DROP NOT NULL;