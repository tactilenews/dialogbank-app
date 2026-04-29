import type { Page } from "@playwright/test";
import { answers, classifications, conversations } from "./dashboard.e2e.spec/data";
import { schema } from "./lib/db";
import { expect, test } from "./lib/fixtures";

async function signIn(page: Page) {
	await page.goto("/", { waitUntil: "networkidle" });
	await page.getByRole("link", { name: "Anmelden" }).click();
	await page.getByLabel("E-Mail-Adresse").fill("editor@example.org");
	await page.getByLabel("Passwort").fill("12341234");
	await page.getByRole("button", { name: "Anmelden" }).click();
	await expect(page).toHaveURL("/");
}

test.describe("Editor Dashboard E2E", () => {
	test("shows classification count cards on the main dashboard page", async ({
		auth,
		db,
		page,
	}) => {
		await db.insert(schema.conversations).values(conversations);
		await db.insert(schema.classifications).values(classifications);
		await db.insert(schema.answers).values(answers);

		await auth.api.signUpEmail({
			body: { email: "editor@example.org", password: "12341234", name: "Editor" },
		});

		await signIn(page);
		await page.getByRole("link", { name: "Auswertung" }).click();

		// Main page shows classification count cards
		await expect(page.getByTestId("classification-card-problem-mit-gelsenkirchen")).toBeVisible();
		await expect(page.getByRole("link", { name: /Nicht klassifiziert/ })).toBeVisible();

		// Unclassified card shows count 1
		await expect(
			page.getByRole("link", { name: /Nicht klassifiziert/ }).getByText("1"),
		).toBeVisible();
	});

	test("navigates to classification detail and reclassifies an answer", async ({
		auth,
		db,
		page,
	}) => {
		await db.insert(schema.conversations).values(conversations);
		await db.insert(schema.classifications).values(classifications);
		await db.insert(schema.answers).values(answers);

		await auth.api.signUpEmail({
			body: { email: "editor@example.org", password: "12341234", name: "Editor" },
		});

		await signIn(page);
		await page.getByRole("link", { name: "Auswertung" }).click();

		// Click the "Nicht klassifiziert" card to navigate to the detail page
		await page.getByRole("link", { name: /Nicht klassifiziert/ }).click();
		await expect(page).toHaveURL(/\/editor\/dashboard\/classification\/unclassified/);

		const movedAnswer = "This answer still needs a classification.";
		await expect(page.getByText(movedAnswer)).toBeVisible();

		// Reclassify: move to "Problem mit Gelsenkirchen"
		await page.getByTestId("answer-301-classification").selectOption("3");
		await page.getByTestId("answer-301-save").click();

		// Answer should be removed from this view after reclassification
		await expect(page.getByText(movedAnswer)).not.toBeVisible();
	});

	test("creates and deletes a classification with a warning for non-empty ones", async ({
		auth,
		db,
		page,
	}) => {
		await db.insert(schema.conversations).values(conversations);
		await db.insert(schema.classifications).values(classifications);
		await db.insert(schema.answers).values(answers);

		await auth.api.signUpEmail({
			body: { email: "editor@example.org", password: "12341234", name: "Editor" },
		});

		await signIn(page);
		await page.getByRole("link", { name: "Auswertung" }).click();

		// Create a new classification
		const newLabelInput = page.locator('input[name="label"][placeholder="Neue Klassifizierung…"]');
		await newLabelInput.fill("TestKlasse");
		await page.getByRole("button", { name: "Anlegen" }).click();
		await expect(page.getByText("Klassifizierung angelegt.")).toBeVisible();

		// Delete "Problem mit Gelsenkirchen" (has 1 answer) → should show a warning
		const contraRow = page.getByRole("row").filter({ hasText: "problem-mit-gelsenkirchen" });
		await contraRow.getByRole("button", { name: "Löschen" }).click();
		await expect(page.getByText("enthält", { exact: false })).toBeVisible();

		// Confirm deletion
		await page.getByRole("button", { name: "Trotzdem löschen" }).click();
		await expect(page.getByText("Klassifizierung gelöscht.")).toBeVisible();

		// Navigate to unclassified page — the answer from "Problem mit Gelsenkirchen" should now be there
		await page.getByRole("link", { name: /Nicht klassifiziert/ }).click();
		await expect(page.getByText("The city center feels neglected.")).toBeVisible();
	});
});
