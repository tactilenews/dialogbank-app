import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import Page from "./+page.svelte";
import {
	sampleEditorPageData,
	sampleEditorPageDataAfterManualClassification,
} from "./page.svelte.spec/data";

describe("/editor/dashboard +page.svelte", () => {
	it("renders summary stats and chart", async () => {
		render(Page, { props: { data: sampleEditorPageData } });

		const heading = page.getByRole("heading", { name: "Antworten im Überblick" });
		await expect.element(heading).toBeVisible();

		const successfulConversationsCard = page.getByText(/Erfolgreiche Gespräche\s*3/);
		await expect.element(successfulConversationsCard).toBeVisible();

		const totalAnswersCard = page.getByText(/Antworten insgesamt\s*6/);
		await expect.element(totalAnswersCard).toBeVisible();

		await expect.element(page.getByText("Gespräche pro Tag")).toBeVisible();
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
		await expect.element(page.getByRole("heading", { name: "Nicht klassifiziert" })).toBeVisible();
	});

	it("renders a manual classification form for each answer", async () => {
		render(Page, { props: { data: sampleEditorPageData } });

		const unclassifiedSelect = page.getByTestId("answer-98-classification");
		const saveButton = page.getByTestId("answer-98-save");

		await expect.element(unclassifiedSelect).toBeVisible();
		await expect.element(unclassifiedSelect).toHaveValue("");
		await expect.element(saveButton).toBeVisible();
	});

	it("shows the field rationale inline", async () => {
		render(Page, { props: { data: sampleEditorPageData } });

		const unclassifiedCard = page.getByTestId("classification-unclassified");
		await expect
			.element(
				unclassifiedCard.getByText(
					"The source answer is ambiguous and needs editor review before classification.",
				),
			)
			.toBeVisible();
	});

	it("recomputes classification sections when the page data updates", async () => {
		const view = render(Page, { props: { data: sampleEditorPageData } });

		const unclassifiedCard = page.getByTestId("classification-unclassified");
		await expect
			.element(unclassifiedCard.getByText("Needs review before it can be categorized."))
			.toBeVisible();
		await expect
			.element(unclassifiedCard.getByText("Another answer still waiting for classification."))
			.toBeVisible();
		await expect.element(page.getByTestId("answer-98-classification")).toHaveValue("");
		await expect.element(page.getByTestId("answer-97-classification")).toHaveValue("");

		await view.rerender({
			data: sampleEditorPageDataAfterManualClassification,
		});

		const supportCard = page.getByTestId("classification-support");
		await expect
			.element(supportCard.getByText("Needs review before it can be categorized."))
			.toBeVisible();
		await expect.element(page.getByTestId("answer-98-classification")).toHaveValue("1");
		await expect
			.element(
				page
					.getByTestId("classification-unclassified")
					.getByText("Another answer still waiting for classification."),
			)
			.toBeVisible();
		await expect.element(page.getByTestId("answer-97-classification")).toHaveValue("");
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
