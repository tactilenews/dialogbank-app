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
		await expect.element(page.getByText("2026-03-14")).toBeVisible();
		await expect.element(page.getByText("4", { exact: true })).toBeVisible();
		await expect.element(page.getByText("2026-03-14T10:45:00.000Z")).not.toBeInTheDocument();
		await expect.element(page.getByText("2026-03-14 00:00:00")).not.toBeInTheDocument();
	});

	it("renders the empty state", async () => {
		render(DashboardConversationChart, { props: { conversationsPerDay: emptyConversationDays } });

		await expect.element(page.getByText("Es wurden noch keine Gespräche erfasst.")).toBeVisible();
	});
});
