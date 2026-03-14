import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import Page from "./+page.svelte";
import { sampleEditorPageData } from "./page.svelte.spec/data";

describe("/editor +page.svelte", () => {
	it("renders summary stats and chart", async () => {
		render(Page, { props: { data: sampleEditorPageData } });

		const heading = page.getByRole("heading", { name: "Answer overview" });
		await expect.element(heading).toBeVisible();

		await expect.element(page.getByText("Successful conversations")).toBeVisible();
		await expect.element(page.getByText("3")).toBeVisible();

		await expect.element(page.getByText("Total answers")).toBeVisible();
		await expect.element(page.getByText("6")).toBeVisible();

		await expect.element(page.getByText("Conversations per day")).toBeVisible();
		await expect.element(page.getByText("2026-03-12")).toBeVisible();
	});

	it("groups answers by classification", async () => {
		render(Page, { props: { data: sampleEditorPageData } });

		const supportGroup = page.getByRole("heading", { name: "Support" });
		await expect.element(supportGroup).toBeVisible();
		await expect.element(page.getByTestId("classification-support")).toBeVisible();

		await expect.element(page.getByText("Mara Klein")).toBeVisible();
		await expect.element(page.getByText("Start a weekly neighborhood market.")).toBeVisible();
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
