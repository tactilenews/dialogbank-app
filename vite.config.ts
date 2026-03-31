import path from "node:path";
import { fileURLToPath } from "node:url";
import { sentrySvelteKit } from "@sentry/sveltekit";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { playwright } from "@vitest/browser-playwright";
import devtoolsJson from "vite-plugin-devtools-json";
import { defineConfig } from "vitest/config";

const dirname =
	typeof __dirname !== "undefined" ? __dirname : path.dirname(fileURLToPath(import.meta.url));
const sentryRelease = process.env.COMMIT_REF ?? process.env.SENTRY_RELEASE ?? null;
const isVitest = process.env.VITEST === "true";
const isPlaywright = process.env.PLAYWRIGHT_TEST === "1";
const disableSentry = isVitest || isPlaywright;

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon

export default defineConfig({
	define: {
		__SENTRY_RELEASE__: JSON.stringify(sentryRelease),
	},
	plugins: [
		disableSentry
			? null
			: sentrySvelteKit({
					sourceMapsUploadOptions: {
						authToken: process.env.SENTRY_AUTH_TOKEN,
						org: process.env.SENTRY_ORG,
						project: process.env.SENTRY_PROJECT,
						release: sentryRelease ? { inject: true, name: sentryRelease } : undefined,
					},
				}),
		tailwindcss(),
		sveltekit(),
		devtoolsJson(),
	],
	test: {
		expect: {
			requireAssertions: true,
		},
		projects: [
			{
				extends: "./vite.config.ts",
				test: {
					name: "client",
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [
							{
								browser: "chromium",
								headless: true,
							},
						],
					},
					include: ["src/**/*.svelte.{test,spec}.{js,ts}"],
					exclude: ["src/lib/server/**", "**/*.e2e.spec.ts"],
				},
			},
			{
				extends: "./vite.config.ts",
				test: {
					name: "server",
					environment: "node",
					setupFiles: ["./vitest.setup.ts"],
					include: ["src/**/*.spec.ts", "e2e/lib/**/*.spec.ts"],
					exclude: ["src/**/*.svelte.spec.ts", "**/*.e2e.spec.ts"],
				},
			},
			{
				extends: true,
				plugins: [
					// The plugin will run tests for the stories defined in your Storybook config
					// See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
					storybookTest({
						configDir: path.join(dirname, ".storybook"),
					}),
				],
				test: {
					name: "storybook",
					browser: {
						enabled: true,
						headless: true,
						provider: playwright({}),
						instances: [
							{
								browser: "chromium",
							},
						],
					},
					setupFiles: [".storybook/vitest.setup.ts"],
					exclude: ["**/*.e2e.spec.ts"],
				},
			},
		],
	},
});
