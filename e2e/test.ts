import { expect, test } from '@playwright/test';

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
