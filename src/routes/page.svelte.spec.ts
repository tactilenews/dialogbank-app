import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';

describe('/+page.svelte', () => {
	it('renders h1', async () => {
		render(Page, { props: { data: { user: null } } });

		const heading = page.getByRole('heading', { name: 'DialogBank' });
		await expect.element(heading).toBeInTheDocument();
	});
});
