import { answers, classifications, conversations } from "./dialogbank.e2e.spec/data";
import { schema } from "./lib/db";
import { expect, test } from "./lib/fixtures";
import { createElevenLabsSignature } from "./lib/webhook";

test.describe("DialogBank E2E", () => {
	test("shows stats counters and highlights the current classification", async ({ db, page }) => {
		await db.insert(schema.conversations).values(conversations);
		await db.insert(schema.classifications).values(classifications);
		await db.insert(schema.answers).values(answers);

		await page.goto("/dialogbank", { waitUntil: "networkidle" });

		await expect(page.getByTestId("stat-guests")).toContainText("1");
		await expect(page.getByTestId("stat-answers")).toContainText("2");
		await expect(page.getByTestId("stat-proGelsenkirchen")).toContainText("0");
		await expect(page.getByTestId("stat-conGelsenkirchen")).toContainText("1");
		await expect(page.getByTestId("stat-ideaGelsenkirchen")).toContainText("0");

		const activeQuote = page.locator('[data-testid="current-quote"]:not([inert])');

		await expect
			.poll(
				async () => {
					const quoteText = await activeQuote.textContent();
					if (!quoteText) return false;
					return quoteText.includes("Ja, ist jetzt nicht so hübsch.");
				},
				{ timeout: 20000, interval: 1000 },
			)
			.toBe(true);

		await expect(page.getByTestId("stat-conGelsenkirchen")).toHaveAttribute(
			"data-highlighted",
			"true",
		);
	});

	test("rotates the quote card", async ({ db, page }) => {
		await db.insert(schema.conversations).values(conversations);
		await db.insert(schema.classifications).values(classifications);
		await db.insert(schema.answers).values(answers);

		await page.goto("/dialogbank", { waitUntil: "networkidle" });

		const quoteCard = page.locator('[data-testid="current-quote"]:not([inert])');
		const initialText = (await quoteCard.textContent())?.trim() ?? "";

		await expect
			.poll(async () => (await quoteCard.textContent())?.trim() ?? "", {
				timeout: 20000,
				interval: 1000,
			})
			.not.toBe(initialText);
	});

	test("auto-refreshes stats after webhook fires", async ({ db, page, request }) => {
		void db; // trigger database teardown because the following steps write to the database

		// Navigate to an empty DialogBank page
		await page.goto("/dialogbank", { waitUntil: "networkidle" });

		// Verify baseline: guests stat shows 0
		await expect(page.getByTestId("stat-guests")).toContainText("0");

		// Fire a signed webhook POST that inserts a conversation + answer
		const payload = {
			type: "post_call_transcription",
			data: {
				conversation_id: "e2e-conv-auto-refresh",
				agent_id: "e2e-agent-auto-refresh",
				analysis: {
					transcript_summary: "Auto-refresh test summary",
					data_collection_results: {
						first_name: {
							data_collection_id: "first_name",
							value: "Anna",
							rationale: "Said Anna",
						},
						publication_allowed: {
							data_collection_id: "publication_allowed",
							value: true,
							rationale: "Agreed",
						},
						favorite_color: {
							data_collection_id: "favorite_color",
							value: "blue",
							rationale: "Said blue",
						},
					},
					call_successful: "success",
				},
			},
		};

		const body = JSON.stringify(payload);
		const signatureHeader = createElevenLabsSignature(body);

		const response = await request.post("/webhook/elevenlabs/post-call", {
			data: body,
			headers: {
				"Content-Type": "application/json",
				"ElevenLabs-Signature": signatureHeader,
			},
		});
		await expect(response.json()).resolves.toEqual({ success: true });

		// Poll for the stat counter to update without any manual page.reload()
		// Timeout must exceed the refresh interval (15s) by a safe margin.
		await expect
			.poll(
				async () => {
					const text = await page.getByTestId("stat-guests").textContent();
					return text?.trim();
				},
				{ timeout: 30000, interval: 1000 },
			)
			.toContain("1");

		// Also assert answer count updated
		await expect(page.getByTestId("stat-answers")).toContainText("1");
	});
});
