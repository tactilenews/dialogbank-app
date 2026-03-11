import { test as base, expect } from "@playwright/test";
import * as seed from "drizzle-seed";
import { auth } from "./lib/auth";
import { db, schema } from "./lib/db";

type Fixtures = {
	auth: typeof auth;
};

const test = base.extend<Fixtures>({
	auth: async ({}, use) => {
		await seed.reset(db, schema);
		await use(auth);
	},
});

test("index page has expected h1", async ({ page }) => {
	await page.goto("/");
	await expect(page.getByRole("heading", { name: "DialogBank" })).toBeVisible();
});

test("dialogbank page redirects to sign-in when unauthenticated", async ({ page }) => {
	await page.goto("/dialogbank");
	await expect(page).toHaveURL("/auth/sign-in");
});

test("sign-in page has expected heading", async ({ page }) => {
	await page.goto("/auth/sign-in");
	await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible();
});

test("signs in with a user record", async ({ auth, page }) => {
	await auth.api.signUpEmail({
		body: {
			email: "user@example.org",
			password: "12341234",
			name: "John Doe",
		},
	});

	await page.goto("/auth/sign-in");
	await page.getByLabel("Email address").fill("user@example.org");
	await page.getByLabel("Password").fill("12341234");
	await page.getByRole("button", { name: "Sign In" }).click();

	await expect(page).toHaveURL("/dialogbank");
	await expect(page.getByRole("heading", { name: "DialogBank Agent Explorer" })).toBeVisible();
});
