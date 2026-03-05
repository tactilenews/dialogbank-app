import { expect, test } from '@playwright/test';

test('dialogbank page shows the name of the agent', async ({ page }) => {
	await page.goto('/dialogbank');

	await expect(page.getByRole('heading', { name: 'DialogBank Agent Explorer' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Roberts Agent zum Ausprobieren' })).toBeVisible();
});
