ALTER TABLE "assignments" ADD COLUMN "elevenlabs_agent_id" text;--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "elevenlabs_agent_version_id" text;--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "agent_configured_at" timestamp;--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "agent_configuration_error" text;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_elevenlabs_agent_id_unique" UNIQUE("elevenlabs_agent_id");