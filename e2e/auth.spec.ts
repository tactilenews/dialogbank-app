import { expect, test } from "./lib/fixtures";

test.describe("Authentication", () => {
	test("unauthenticated users cannot access /editor/agent and are redirected to sign-in", async ({
		page,
	}) => {
		// Attempt to access protected route
		await page.goto("/editor/agent");
		await expect(page).toHaveURL("/auth/sign-in");

		// Verify sign-in page renders correctly
		await expect(page.getByRole("heading", { name: "Sign-in" })).toBeVisible();
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
		await page.getByLabel("Email address").fill("user@example.org");
		await page.getByLabel("Password").fill("12341234");
		await page.getByRole("button", { name: "Sign-in" }).click();

		// Verify successful redirect to the start page
		await expect(page).toHaveURL("/");
		await expect(page.getByRole("heading", { name: "DialogBank" })).toBeVisible();
		await expect(page.getByRole("link", { name: "DialogBank" })).toBeVisible();
		await expect(page.getByRole("link", { name: "Editor Agent" })).toBeVisible();
		await expect(page.getByRole("link", { name: "Editor Dashboard" })).toBeVisible();

		await page.getByRole("link", { name: "Editor Agent" }).click();
		await expect(page).toHaveURL("/editor/agent");
		await expect(page.getByRole("heading", { name: "Editor Agent" })).toBeVisible();
	});
});
