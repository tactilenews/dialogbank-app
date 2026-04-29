INSERT INTO "questions" ("assignment_id", "text", "display_order") VALUES
  (1, 'So, erst mal zu Dir: Woher kommst Du eigentlich genau?', 0),
  (1, 'Jetzt sag mal ehrlich: Wie gefällt Dir die Innenstadt von Gelsenkirchen so?', 1),
  (1, 'Stell Dir mal vor: Wenn Du OB von Gelsenkirchen wärst – was würdest Du als Erstes verbessern?', 2),
  (1, 'Nun mal kurz zu uns: Was hältst Du davon, dass wir vom WDR mit dem PopUp Studio gerade hier in Gelsenkirchen sind?', 3),
  (1, 'Und mal ganz grundsätzlich gefragt: Wie findest Du den WDR im Allgemeinen?', 4);--> statement-breakpoint
INSERT INTO "classifications" ("key", "label") VALUES
  ('gute-sache-ueber-gelsenkirchen', 'Gute Sache über Gelsenkirchen'),
  ('problem-mit-gelsenkirchen', 'Problem mit Gelsenkirchen'),
  ('idee-fuer-gelsenkirchen', 'Idee für Gelsenkirchen')
ON CONFLICT ("key") DO NOTHING;--> statement-breakpoint
INSERT INTO "question_classifications" ("question_id", "classification_id")
  SELECT q.id, c.id
  FROM "questions" q, "classifications" c
  WHERE q.text LIKE '%Innenstadt%'
    AND c.key IN ('gute-sache-ueber-gelsenkirchen', 'problem-mit-gelsenkirchen');--> statement-breakpoint
INSERT INTO "question_classifications" ("question_id", "classification_id")
  SELECT q.id, c.id
  FROM "questions" q, "classifications" c
  WHERE q.text LIKE '%OB von Gelsenkirchen%'
    AND c.key = 'idee-fuer-gelsenkirchen';
