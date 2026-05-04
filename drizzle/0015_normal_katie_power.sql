ALTER TABLE "assignments" ADD COLUMN "slug" text;--> statement-breakpoint
WITH normalized_assignments AS (
	SELECT
		"id",
		COALESCE(
			NULLIF(
				trim(both '-' from regexp_replace(
					replace(replace(replace(replace(lower("name"), 'ä', 'ae'), 'ö', 'oe'), 'ü', 'ue'), 'ß', 'ss'),
					'[^a-z0-9]+',
					'-',
					'g'
				)),
				''
			),
			'einsatz'
		) AS "base_slug"
	FROM "assignments"
),
ranked_assignments AS (
	SELECT
		"id",
		"base_slug",
		row_number() OVER (PARTITION BY "base_slug" ORDER BY "id") AS "base_rank"
	FROM normalized_assignments
),
candidate_assignments AS (
	SELECT
		"id",
		CASE
			WHEN "base_rank" = 1 THEN "base_slug"
			ELSE "base_slug" || '-' || "base_rank"
		END AS "candidate_slug"
	FROM ranked_assignments
),
unique_assignments AS (
	SELECT
		"id",
		CASE
			WHEN count(*) OVER (PARTITION BY "candidate_slug") = 1 THEN "candidate_slug"
			ELSE "candidate_slug" || '--' || "id"
		END AS "slug"
	FROM candidate_assignments
)
UPDATE "assignments"
SET "slug" = unique_assignments."slug"
FROM unique_assignments
WHERE "assignments"."id" = unique_assignments."id";--> statement-breakpoint
ALTER TABLE "assignments" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_slug_unique" UNIQUE("slug"); 
