import type { Page } from "@playwright/test";
import type { auth as authType } from "./lib/auth";
import { expect, test } from "./lib/fixtures";

const EXISTING_QUESTIONS = [
	"So, erst mal zu Dir: Woher kommst Du eigentlich genau?",
	"Jetzt sag mal ehrlich: Wie gefällt Dir die Innenstadt von Gelsenkirchen so?",
	"Stell Dir mal vor: Wenn Du OB von Gelsenkirchen wärst – was würdest Du als Erstes verbessern?",
	"Nun mal kurz zu uns: Was hältst Du davon, dass wir vom WDR mit dem PopUp Studio gerade hier in Gelsenkirchen sind?",
	"Und mal ganz grundsätzlich gefragt: Wie findest Du den WDR im Allgemeinen?",
];

const NEW_QUESTION = "Wie finden Sie das neue Fragebogen-Tool?";

const CLASSIFICATION_LABEL = "E2E-Testklassifizierung";
const CLASSIFICATION_KEY = "e2e-testklassifizierung";

async function signIn(page: Page, auth: typeof authType) {
	await auth.api.signUpEmail({
		body: { email: "editor@example.org", password: "12341234", name: "Editor" },
	});
	await page.goto("/auth/sign-in");
	await page.getByLabel("E-Mail-Adresse").fill("editor@example.org");
	await page.getByLabel("Passwort").fill("12341234");
	await page.getByRole("button", { name: "Anmelden" }).click();
	await expect(page).toHaveURL("/");
}

test.describe("Agent Editor", () => {
	test("shows existing questions, persists edits, and reflects changes after page reload", async ({
		auth,
		elevenLabsBranch: _,
		page,
	}) => {
		await signIn(page, auth);

		await page.goto("/editor/agent", { waitUntil: "networkidle" });

		const questionInputs = page.locator('input[name="questions"]');

		// Verify all 5 existing questions are displayed in order
		await expect(questionInputs).toHaveCount(5);
		for (let i = 0; i < EXISTING_QUESTIONS.length; i++) {
			await expect(questionInputs.nth(i)).toHaveValue(EXISTING_QUESTIONS[i]);
		}

		// Add a new question
		await page.getByRole("button", { name: "+ Frage hinzufügen" }).click();
		await questionInputs.last().fill(NEW_QUESTION);
		await expect(questionInputs).toHaveCount(6);

		// Remove the first question
		await page.getByRole("button", { name: "Frage 1 entfernen" }).click();
		await expect(questionInputs).toHaveCount(5);
		await expect(questionInputs.first()).toHaveValue(EXISTING_QUESTIONS[1]);

		// Capture the POST response before clicking save
		const responsePromise = page.waitForResponse(
			(response) =>
				response.url().includes("/editor/agent") && response.request().method() === "POST",
		);

		await page.getByRole("button", { name: "Speichern" }).click();

		const response = await responsePromise;
		expect(response.status()).toBe(200);

		await expect(page.getByText("Fragen wurden gespeichert.")).toBeVisible();

		// Reload and verify persistence
		await page.goto("/editor/agent", { waitUntil: "networkidle" });

		// Should have 5 questions: Q2–Q5 + new question
		await expect(questionInputs).toHaveCount(5);

		// Removed question should no longer appear
		await expect(questionInputs.first()).toHaveValue(EXISTING_QUESTIONS[1]);

		// Remaining original questions should still be present in order
		for (let i = 0; i < EXISTING_QUESTIONS.slice(1).length; i++) {
			await expect(questionInputs.nth(i)).toHaveValue(EXISTING_QUESTIONS[i + 1]);
		}

		// Newly added question should be the last
		await expect(questionInputs.last()).toHaveValue(NEW_QUESTION);
	});

	test("saves a classification for a question and reflects it in the data collection after page reload", async ({
		auth,
		elevenLabsBranch: _,
		page,
	}) => {
		await signIn(page, auth);

		await page.goto("/editor/agent", { waitUntil: "networkidle" });

		// Scope to the first question card to avoid collisions with pre-existing
		// classifications from the upstream agent snapshot
		const firstQuestionCard = page
			.getByRole("button", { name: "Frage 1 entfernen" })
			.locator("xpath=../..");

		// Add a classification to the first question
		await firstQuestionCard.getByRole("button", { name: "+ Klassifizierung hinzufügen" }).click();
		// The new classification is appended last within this card
		await firstQuestionCard.getByPlaceholder("Label").last().fill(CLASSIFICATION_LABEL);

		// The derived key preview should appear below the newly filled input
		await expect(
			firstQuestionCard.getByText(CLASSIFICATION_KEY, { exact: true }).last(),
		).toBeVisible();

		// Capture the POST response before clicking save
		const responsePromise = page.waitForResponse(
			(response) =>
				response.url().includes("/editor/agent") && response.request().method() === "POST",
		);

		await page.getByRole("button", { name: "Speichern" }).click();

		const response = await responsePromise;
		expect(response.status()).toBe(200);

		await expect(page.getByText("Fragen wurden gespeichert.")).toBeVisible();

		// Reload and verify the classification and its data collection entry persist
		await page.goto("/editor/agent", { waitUntil: "networkidle" });

		const firstQuestionCardAfterReload = page
			.getByRole("button", { name: "Frage 1 entfernen" })
			.locator("xpath=../..");

		await expect(firstQuestionCardAfterReload.getByPlaceholder("Label").last()).toHaveValue(
			CLASSIFICATION_LABEL,
		);
		await expect(page.getByText("classification_0")).toBeVisible();
		// The description field in the debug panel contains "key: label" lines
		await expect(page.getByText(`${CLASSIFICATION_KEY}: ${CLASSIFICATION_LABEL}`)).toBeVisible();
	});
});
