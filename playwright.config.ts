import { defineConfig } from '@playwright/test';

export default defineConfig({
	webServer: { command: 'pnpm run build && pnpm run preview', port: 4173 },
	testDir: 'e2e',
	testMatch: /(.+\.)?(test|spec)\.[jt]s/,
	// Fail the build on CI if you accidentally left test.only in the source code.
	forbidOnly: !!process.env.CI
});
