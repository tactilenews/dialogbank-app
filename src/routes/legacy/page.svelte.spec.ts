import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import Page from "./+page.svelte";
import { sampleLegacyPageData } from "./page.svelte.spec/data";

describe("/legacy +page.svelte", () => {
	it("renders the legacy header and stats", async () => {
		render(Page, { props: { data: sampleLegacyPageData } });

		const heading = page.getByRole("heading", {
			name: "LIVE AUS DER FEEDBACKKABINE ÜBER GELSENKIRCHEN",
		});
		await expect.element(heading).toBeVisible();

		const guests = page.getByTestId("stat-guests");
		await expect.element(guests).toBeVisible();
		await expect.element(page.getByText("3")).toBeVisible();
		await expect.element(page.getByText("Gäste")).toBeVisible();

		const answers = page.getByTestId("stat-answers");
		await expect.element(answers).toBeVisible();
		await expect.element(page.getByText("4")).toBeVisible();
		await expect.element(page.getByText("Antworten")).toBeVisible();
	});

	it("highlights the classification for the visible quote", async () => {
		render(Page, { props: { data: sampleLegacyPageData } });

		const highlightedStat = page.getByTestId("stat-proGelsenkirchen");
		await expect.element(highlightedStat).toHaveAttribute("data-highlighted", "true");

		const ideaStat = page.getByTestId("stat-ideaGelsenkirchen");
		await expect.element(ideaStat).toHaveAttribute("data-highlighted", "false");

		const quote = page.getByText("Gelsenkirchen hält zusammen.");
		await expect.element(quote).toBeVisible();
	});
});
