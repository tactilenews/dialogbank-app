import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import Page from "./+page.svelte";
import { sampleShowcasePageData } from "./page.svelte.spec/data";

const itWithSpies = it.extend<{ spyOn: typeof vi.spyOn }>({
	// biome-ignore lint/correctness/noEmptyPattern: Vitest fixture requires destructuring pattern
	spyOn: async ({}, use) => {
		await use(vi.spyOn);
		vi.restoreAllMocks();
	},
});

describe("/showcase +page.svelte", () => {
	it("renders the showcase header and stats", async () => {
		render(Page, { props: { data: sampleShowcasePageData } });

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

	itWithSpies("highlights the classification for the visible quote", async ({ spyOn }) => {
		spyOn(Math, "random").mockReturnValue(0);
		render(Page, { props: { data: sampleShowcasePageData } });

		const highlightedStat = page.getByTestId("stat-proGelsenkirchen");
		await expect.element(highlightedStat).toHaveAttribute("data-highlighted", "true");

		const ideaStat = page.getByTestId("stat-ideaGelsenkirchen");
		await expect.element(ideaStat).toHaveAttribute("data-highlighted", "false");

		const quote = page.getByText("Gelsenkirchen hält zusammen.");
		await expect.element(quote).toBeVisible();
	});
});
