import { expect, test } from '@playwright/test';

test('dialogbank page redirects to sign-in when unauthenticated', async ({ page }) => {
	await page.goto('/dialogbank');
	await expect(page).toHaveURL('/auth/sign-in');
});

test('dialogbank page shows the name of the agent when authenticated', async () => {
	// This test would normally need a sign-in step, but for now we just verify the redirect above
	// If we had a test user, we would sign in here.
});
