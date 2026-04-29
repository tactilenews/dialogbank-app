import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import Page from "./+page.svelte";
import { sampleEditorPageData } from "./page.svelte.spec/data";

describe("/editor/dashboard +page.svelte", () => {
	it("renders summary stats and chart", async () => {
		render(Page, { props: { data: sampleEditorPageData } });

		await expect
			.element(page.getByRole("heading", { name: "Antworten im Überblick" }))
			.toBeVisible();
		await expect.element(page.getByText(/Erfolgreiche Gespräche\s*3/)).toBeVisible();
		await expect.element(page.getByText(/Antworten insgesamt\s*6/)).toBeVisible();
		await expect.element(page.getByText("Gespräche pro Tag")).toBeVisible();
	});

	it("shows classification count cards with links", async () => {
		render(Page, { props: { data: sampleEditorPageData } });

		const ideaCard = page.getByTestId("classification-card-idea");
		const supportCard = page.getByTestId("classification-card-support");
		const unclassifiedCard = page.getByTestId("classification-card-unclassified");

		await expect.element(ideaCard).toBeVisible();
		await expect.element(supportCard).toBeVisible();
		await expect.element(unclassifiedCard).toBeVisible();

		await expect.element(ideaCard.getByText("1")).toBeVisible();
		await expect.element(supportCard.getByText("3")).toBeVisible();
		await expect.element(unclassifiedCard.getByText("2")).toBeVisible();
	});

	it("links classification cards to the detail page", async () => {
		render(Page, { props: { data: sampleEditorPageData } });

		await expect
			.element(page.getByTestId("classification-card-idea"))
			.toHaveAttribute("href", expect.stringContaining("/editor/dashboard/classification/idea"));
		await expect
			.element(page.getByTestId("classification-card-unclassified"))
			.toHaveAttribute(
				"href",
				expect.stringContaining("/editor/dashboard/classification/unclassified"),
			);
	});

	it("renders the classification manager section", async () => {
		render(Page, { props: { data: sampleEditorPageData } });

		await expect
			.element(page.getByRole("heading", { name: "Klassifizierungen verwalten" }))
			.toBeVisible();
		await expect.element(page.getByRole("button", { name: "Anlegen" })).toBeVisible();
		// Manager table shows classification keys in the key column
		await expect.element(page.getByRole("cell", { name: "idea", exact: true })).toBeVisible();
		await expect.element(page.getByRole("cell", { name: "support", exact: true })).toBeVisible();
	});
});
