import { defineConfig } from "@playwright/test";

/**
 * Force e2e tests to use the dedicated e2e database on port 5433.
 */
const E2E_DATABASE_URL = "postgres://user:password@localhost:5433/neondb";
const E2E_ORIGIN = "http://localhost:4173";
const E2E_ELEVENLABS_WEBHOOK_SECRET = "test-elevenlabs-webhook-secret";

process.env.ORIGIN ??= E2E_ORIGIN;
process.env.BETTER_AUTH_SECRET ??= "better-auth-secret-with-32-characters-for-testing-only";
process.env.ELEVENLABS_WEBHOOK_SECRET ??= E2E_ELEVENLABS_WEBHOOK_SECRET;

export default defineConfig({
	webServer: {
		command: "pnpm run build && pnpm run preview",
		port: 4173,
		reuseExistingServer: !process.env.CI,
		env: {
			DATABASE_URL: E2E_DATABASE_URL,
		},
	},
	testDir: "e2e",
	testMatch: /(.+\.)?spec\.[jt]s/,
	// Run tests in isolation.
	workers: 1,
	// Fail the build on CI if you accidentally left test.only in the source code.
	forbidOnly: !!process.env.CI,
});
