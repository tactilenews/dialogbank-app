import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import Page from "./+page.svelte";
import { sampleEditorPageData } from "./page.svelte.spec/data";

describe("/editor/dashboard +page.svelte", () => {
	it("renders summary stats and chart", async () => {
		render(Page, { props: { data: sampleEditorPageData } });

		const heading = page.getByRole("heading", { name: "Answer overview" });
		await expect.element(heading).toBeVisible();

		const successfulConversationsCard = page.getByText(/Successful conversations\s*3/);
		await expect.element(successfulConversationsCard).toBeVisible();

		const totalAnswersCard = page.getByText(/Total answers\s*6/);
		await expect.element(totalAnswersCard).toBeVisible();

		await expect.element(page.getByText("Conversations per day")).toBeVisible();
		await expect.element(page.getByText("2026-03-12")).toBeVisible();
	});

	it("groups answers by classification", async () => {
		render(Page, { props: { data: sampleEditorPageData } });

		const supportGroup = page.getByRole("heading", { name: "Support" });
		const supportCard = page.getByTestId("classification-support");
		const unclassifiedCard = page.getByTestId("classification-unclassified");

		await expect.element(supportGroup).toBeVisible();
		await expect.element(supportCard).toBeVisible();
		await expect.element(unclassifiedCard).toBeVisible();

		await expect.element(supportCard.getByText("Mara Klein")).toBeVisible();
		await expect.element(page.getByText("Start a weekly neighborhood market.")).toBeVisible();
		await expect.element(page.getByRole("heading", { name: "Unclassified" })).toBeVisible();
	});

	it("shows per-classification pagination", async () => {
		render(Page, { props: { data: sampleEditorPageData } });

		await expect.element(page.getByTestId("pagination-support-next")).toBeVisible();
		await expect
			.element(page.getByTestId("pagination-support-previous"))
			.toHaveAttribute("href", "?page_support=1#classification-support");
	});

	it("preserves the classification anchor on pagination links", async () => {
		render(Page, { props: { data: sampleEditorPageData } });

		await expect
			.element(page.getByTestId("pagination-support-next"))
			.toHaveAttribute("href", "?page_support=2#classification-support");
	});
});
