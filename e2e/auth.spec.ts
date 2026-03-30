import { expect, test } from "./lib/fixtures";

test.describe("Authentication", () => {
	test("unauthenticated users cannot access /editor/agent and are redirected to sign in", async ({
		page,
	}) => {
		// Attempt to access protected route
		await page.goto("/editor/agent");
		await expect(page).toHaveURL("/auth/sign-in");

		// Verify sign in page renders correctly
		await expect(page.getByRole("heading", { name: "Anmelden" })).toBeVisible();
	});

	test("unauthenticated users cannot post to /editor/dashboard", async ({ page }) => {
		await page.goto("/", { waitUntil: "networkidle" });

		await page.evaluate(() => {
			const form = document.createElement("form");
			form.method = "POST";
			form.action = "/editor/dashboard";

			const answerId = document.createElement("input");
			answerId.type = "hidden";
			answerId.name = "answerId";
			answerId.value = "1";
			form.append(answerId);

			const classificationId = document.createElement("input");
			classificationId.type = "hidden";
			classificationId.name = "classificationId";
			classificationId.value = "1";
			form.append(classificationId);

			document.body.append(form);
			form.submit();
		});

		await expect(page).toHaveURL("/auth/sign-in");
		await expect(page.getByRole("heading", { name: "Anmelden" })).toBeVisible();
	});

	test("signs in successfully with valid credentials", async ({ auth, page }) => {
		// Create a user account
		await auth.api.signUpEmail({
			body: {
				email: "user@example.org",
				password: "12341234",
				name: "John Doe",
			},
		});

		// Sign in with the created user
		await page.goto("/auth/sign-in");
		await page.getByLabel("E-Mail-Adresse").fill("user@example.org");
		await page.getByLabel("Passwort").fill("12341234");
		await page.getByRole("button", { name: "Anmelden" }).click();

		// Verify successful redirect to the start page
		await expect(page).toHaveURL("/");
		await expect(page.getByRole("heading", { name: "DialogBank" })).toBeVisible();
		await expect(page.getByRole("link", { name: "Redaktions-Agent" })).toBeVisible();
		await expect(page.getByRole("link", { name: "Redaktions-Dashboard" })).toBeVisible();

		await page.getByRole("link", { name: "Redaktions-Agent" }).click();
		await expect(page).toHaveURL("/editor/agent");
		const topLevelNav = page.getByLabel("Hauptnavigation");
		await expect(topLevelNav.getByRole("link", { name: "DialogBank" })).toBeVisible();
		await expect(topLevelNav.getByRole("link", { name: "Redaktions-Agent" })).toBeVisible();
		await expect(topLevelNav.getByRole("link", { name: "Redaktions-Dashboard" })).toBeVisible();
		await expect(page.getByRole("heading", { name: "Redaktions-Agent" })).toBeVisible();
	});
});
