import { answers, classifications, conversations } from "./dashboard.spec/data";
import { schema } from "./lib/db";
import { expect, test } from "./lib/fixtures";

test.describe("Editor Dashboard E2E", () => {
	test("updates the selected classification and moves the answer into the new section", async ({
		auth,
		db,
		page,
	}) => {
		await db.insert(schema.conversations).values(conversations);
		await db.insert(schema.classifications).values(classifications);
		await db.insert(schema.answers).values(answers);

		await auth.api.signUpEmail({
			body: {
				email: "editor@example.org",
				password: "12341234",
				name: "Editor",
			},
		});

		await page.goto("/auth/sign-in", { waitUntil: "networkidle" });
		await page.getByLabel("E-Mail-Adresse").fill("editor@example.org");
		await page.getByLabel("Passwort").fill("12341234");
		await page.getByRole("button", { name: "Anmelden" }).click();

		await expect(page).toHaveURL("/");

		await page.goto("/editor/dashboard", { waitUntil: "networkidle" });

		const unclassifiedSection = page.getByTestId("classification-unclassified");
		const contraSection = page.getByTestId("classification-conGelsenkirchen");
		const movedAnswer = "This answer still needs a classification.";

		await expect(unclassifiedSection.getByText(movedAnswer)).toBeVisible();
		await expect(contraSection.getByText("The city center feels neglected.")).toBeVisible();

		await page.getByTestId("answer-301-classification").selectOption("3");
		await page.getByTestId("answer-301-save").click();

		await expect(page.getByText("Antwort wurde Contra Gelsenkirchen zugeordnet.")).toBeVisible();
		await expect(page.getByTestId("answer-301-classification")).toHaveValue("3");
		await expect(contraSection.getByText(movedAnswer)).toBeVisible();
		await expect(unclassifiedSection).toHaveCount(0);
	});
});
