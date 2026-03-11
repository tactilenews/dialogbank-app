import { test as base, expect } from "@playwright/test";
import * as seed from "drizzle-seed";
import { auth } from "./lib/auth";
import { db, schema } from "./lib/db";

type Fixtures = {
	auth: typeof auth;
};

const test = base.extend<Fixtures>({
	// biome-ignore lint/correctness/noEmptyPattern: Playwright fixture requires destructuring pattern
	auth: async ({}, use) => {
		await seed.reset(db, schema);
		await use(auth);
	},
});

test.describe("Authentication", () => {
	test("unauthenticated users cannot access /dialogbank and are redirected to sign-in", async ({
		page,
	}) => {
		// Attempt to access protected route
		await page.goto("/dialogbank");
		await expect(page).toHaveURL("/auth/sign-in");

		// Verify sign-in page renders correctly
		await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible();
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
		await page.getByRole("button", { name: "Sign In" }).click();

		// Verify successful redirect to protected area
		await expect(page).toHaveURL("/dialogbank");
		await expect(page.getByRole("heading", { name: "DialogBank Agent Explorer" })).toBeVisible();
	});
});
