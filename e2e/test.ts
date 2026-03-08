import { expect, test as base } from '@playwright/test';
import { auth } from './lib/auth';
import { db, schema } from './lib/db';
import * as seed from 'drizzle-seed';

type Fixtures = {
	auth: typeof auth;
};

const test = base.extend<Fixtures>({
	// eslint-disable-next-line no-empty-pattern
	auth: async ({}, use) => {
		await use(auth);
		await seed.reset(db, schema);
	}
});

test('index page has expected h1', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'DialogBank' })).toBeVisible();
});

test('dialogbank page redirects to sign-in when unauthenticated', async ({ page }) => {
	await page.goto('/dialogbank');
	await expect(page).toHaveURL('/auth/sign-in');
});

test('sign-in page has expected heading', async ({ page }) => {
	await page.goto('/auth/sign-in');
	await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
});

test('with a user record you can sign in', async ({ auth, page }) => {
	await auth.api.signUpEmail({
		body: {
			email: 'user@example.org',
			password: '12341234',
			name: 'John Doe'
		}
	});

	await page.goto('/auth/sign-in');
	await page.getByLabel('Email address').fill('user@example.org');
	await page.getByLabel('Password').fill('12341234');
	await page.getByRole('button', { name: 'Sign In' }).click();

	await expect(page).toHaveURL('/dialogbank');
	await expect(page.getByRole('heading', { name: 'DialogBank Agent Explorer' })).toBeVisible();
});
