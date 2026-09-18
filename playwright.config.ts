import { defineConfig } from "@playwright/test";

/**
 * Use the dedicated e2e database (published on the host at port 5433 by
 * default). Keep in sync with e2e/lib/db.ts, which the tests use directly.
 */
const E2E_DATABASE_URL =
	process.env.E2E_DATABASE_URL ?? "postgres://user:password@localhost:5433/neondb";
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
	testMatch: /(.+\.)?e2e\.spec\.[jt]s/,
	// Run tests in isolation.
	workers: 1,
	// Fail the build on CI if you accidentally left test.only in the source code.
	forbidOnly: !!process.env.CI,
});
