import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import DashboardAnswerCard from "./DashboardAnswerCard.svelte";
import {
	sampleAnswer,
	sampleClassificationOptions,
	successForm,
} from "./DashboardAnswerCard.svelte.spec/data";

describe("DashboardAnswerCard", () => {
	it("renders the answer content and rationale", async () => {
		render(DashboardAnswerCard, {
			props: {
				answer: sampleAnswer,
				classificationOptions: sampleClassificationOptions,
				form: undefined,
			},
		});

		await expect.element(page.getByText("Mara Klein")).toBeVisible();
		await expect
			.element(page.getByText("Needs review before it can be categorized."))
			.toBeVisible();
		await expect.element(page.getByText("Field rationale")).toBeVisible();
		await expect
			.element(
				page.getByText(
					"The source answer is ambiguous and needs editor review before classification.",
				),
			)
			.toBeVisible();
	});

	it("renders the classification form and matching feedback", async () => {
		render(DashboardAnswerCard, {
			props: {
				answer: sampleAnswer,
				classificationOptions: sampleClassificationOptions,
				form: successForm,
			},
		});

		await expect.element(page.getByTestId("answer-98-classification")).toHaveValue("");
		await expect.element(page.getByTestId("answer-98-save")).toBeVisible();
		await expect.element(page.getByText("Answer moved to Unclassified.")).toBeVisible();
	});
});
