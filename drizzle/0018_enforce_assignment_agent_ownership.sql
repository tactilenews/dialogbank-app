ALTER TABLE "assignments" DROP COLUMN "is_published";--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_elevenlabs_agent_id_unique" UNIQUE("elevenlabs_agent_id");