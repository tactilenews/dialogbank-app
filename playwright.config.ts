import { defineConfig } from "@playwright/test";

export default defineConfig({
	webServer: {
		command: "pnpm run build && pnpm run preview",
		port: 4173,
		reuseExistingServer: !process.env.CI,
	},
	testDir: "e2e",
	testMatch: /(.+\.)?spec\.[jt]s/,
	// Run tests in isolation.
	workers: 1,
	// Fail the build on CI if you accidentally left test.only in the source code.
	forbidOnly: !!process.env.CI,
});
