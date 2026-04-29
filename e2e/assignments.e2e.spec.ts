import type { Page } from "@playwright/test";
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

test.describe("Assignments E2E", () => {
	test("creates a new assignment with questions and classifications and activates it against ElevenLabs", async ({
		auth,
		db,
		page,
		elevenLabsBranch,
	}) => {
		void elevenLabsBranch; // ensure agent snapshot is restored before test

		await auth.api.signUpEmail({
			body: { email: "editor@example.org", password: "12341234", name: "Editor" },
		});

		// Seed existing classification for the test
		await db
			.insert(schema.classifications)
			.values([
				{ id: 200, key: "gute-sache-ueber-gelsenkirchen", label: "Gute Sache über Gelsenkirchen" },
			]);

		await signIn(page);

		// Navigate to assignments via start page link
		await page.getByRole("link", { name: "Einsätze" }).click();
		await expect(page).toHaveURL("/editor/assignments");

		// Open the Standard assignment (seeded by db fixture)
		await page.getByRole("link", { name: "Bearbeiten" }).click();
		await expect(page).toHaveURL(/\/editor\/assignments\/\d+/);

		// Add a question
		await page.getByRole("button", { name: "+ Frage hinzufügen" }).click();
		const questionInputs = page.locator('input[name="questions"]');
		await questionInputs.last().fill("Wie gefällt dir Gelsenkirchen?");

		// Select existing classification "Gute Sache über Gelsenkirchen" (checkbox is sr-only inside a label chip)
		await page.locator("label").filter({ hasText: "Gute Sache über Gelsenkirchen" }).click();

		// Add a new classification via the input
		const newClassInput = page.locator('input[placeholder="Neue Klassifizierung…"]').last();
		await newClassInput.fill("Problem mit Gelsenkirchen");
		await page.getByRole("button", { name: "Hinzufügen", exact: true }).click();

		// Verify "Problem mit Gelsenkirchen (neu)" chip appears
		await expect(page.getByText("Problem mit Gelsenkirchen (neu)", { exact: false })).toBeVisible();

		// Activate
		await page.getByRole("button", { name: "Aktivieren & Agent konfigurieren" }).click();
		await expect(page.getByText("Einsatz aktiviert und Agent konfiguriert.")).toBeVisible();

		// Assert DB state: question-classification links created
		const questionRows = await db.select().from(schema.questions);
		expect(questionRows.some((q) => q.text === "Wie gefällt dir Gelsenkirchen?")).toBe(true);

		const links = await db.select().from(schema.questionClassifications);
		expect(links.length).toBeGreaterThanOrEqual(2); // pro + contra

		// Assert new classification was created
		const contra = await db.query.classifications.findFirst({
			where: (c, { eq }) => eq(c.key, "problem-mit-gelsenkirchen"),
		});
		expect(contra).toBeDefined();

		// Assert ElevenLabs agent data collection updated (agent view shows on the same page)
		const agentSection = page.locator("text=Datenerfassung");
		await expect(agentSection).toBeVisible();
	});
});
