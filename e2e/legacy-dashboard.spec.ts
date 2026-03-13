import { answers, conversations } from "./legacy-dashboard.spec/data";
import { schema } from "./lib/db";
import { expect, test } from "./lib/fixtures";

test.describe("Legacy Dashboard E2E", () => {
	test("shows stats counters and highlights the current classification", async ({ db, page }) => {
		await db.insert(schema.conversations).values(conversations);
		await db.insert(schema.answers).values(answers);

		await page.goto("/legacy", { waitUntil: "networkidle" });

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
		await db.insert(schema.answers).values(answers);

		await page.goto("/legacy", { waitUntil: "networkidle" });

		const quoteCard = page.locator('[data-testid="current-quote"]:not([inert])');
		const initialText = (await quoteCard.textContent())?.trim() ?? "";

		await expect
			.poll(async () => (await quoteCard.textContent())?.trim() ?? "", {
				timeout: 20000,
				interval: 1000,
			})
			.not.toBe(initialText);
	});
});
