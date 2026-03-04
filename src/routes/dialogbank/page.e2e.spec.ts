import { expect, test } from '@playwright/test';

test('dialogbank page shows error message when env variables are not set', async ({ page }) => {
	await page.goto('/dialogbank');

	// When load throws error(500, ...), SvelteKit renders the error page.
	// The +page.svelte component (containing the heading) is NOT rendered.
	await expect(page.getByText('500')).toBeVisible();
	await expect(page.getByText('ELEVENLABS_API_KEY is not configured on the server.')).toBeVisible();

	// Verify that the explorer heading is NOT present
	await expect(page.getByRole('heading', { name: 'DialogBank Agent Explorer' })).not.toBeVisible();
});
