import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import DashboardSummaryStats from "./DashboardSummaryStats.svelte";
import { sampleDashboardStatItems } from "./DashboardSummaryStats.svelte.spec/data";

describe("DashboardSummaryStats", () => {
	it("renders all stat cards", async () => {
		render(DashboardSummaryStats, { props: { statItems: sampleDashboardStatItems } });

		await expect.element(page.getByText(/Successful conversations\s*3/)).toBeVisible();
		await expect.element(page.getByText(/Total answers\s*6/)).toBeVisible();
	});
});
