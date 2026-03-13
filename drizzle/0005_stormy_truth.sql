UPDATE "conversations" AS c
SET "publication_allowed" = true
WHERE EXISTS (
	SELECT 1
	FROM "answers" AS a
	WHERE a."conversation_id" = c."conversation_id"
		AND a."data_collection_id" = 'allow_publication'
		AND a."value" = 'true'
);
--> statement-breakpoint

DELETE FROM "answers"
WHERE "data_collection_id" = 'allow_publication';
