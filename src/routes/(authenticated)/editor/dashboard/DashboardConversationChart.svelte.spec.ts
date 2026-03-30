import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import DashboardConversationChart from "./DashboardConversationChart.svelte";
import {
	emptyConversationDays,
	sampleConversationDays,
} from "./DashboardConversationChart.svelte.spec/data";

describe("DashboardConversationChart", () => {
	it("renders conversation bars", async () => {
		render(DashboardConversationChart, { props: { conversationsPerDay: sampleConversationDays } });

		await expect.element(page.getByText("Gespräche pro Tag")).toBeVisible();
		await expect.element(page.getByText("2026-03-12")).toBeVisible();
		await expect.element(page.getByText("4")).toBeVisible();
	});

	it("renders the empty state", async () => {
		render(DashboardConversationChart, { props: { conversationsPerDay: emptyConversationDays } });

		await expect.element(page.getByText("Es wurden noch keine Gespräche erfasst.")).toBeVisible();
	});
});
