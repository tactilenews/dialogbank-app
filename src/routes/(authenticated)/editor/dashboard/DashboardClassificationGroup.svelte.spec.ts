import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import DashboardClassificationGroup from "./DashboardClassificationGroup.svelte";
import {
	sampleClassificationGroup,
	sampleClassificationOptions,
} from "./DashboardClassificationGroup.svelte.spec/data";

describe("DashboardClassificationGroup", () => {
	it("renders the group heading, answers, and pagination", async () => {
		render(DashboardClassificationGroup, {
			props: {
				group: sampleClassificationGroup,
				classificationOptions: sampleClassificationOptions,
				form: undefined,
			},
		});

		await expect.element(page.getByRole("heading", { name: "Support" })).toBeVisible();
		await expect.element(page.getByText("Page 1 of 2")).toBeVisible();
		await expect.element(page.getByText("Mara Klein")).toBeVisible();
		await expect
			.element(page.getByTestId("pagination-support-next"))
			.toHaveAttribute("href", "?page_support=2#classification-support");
	});
});
