import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import Page from "./+page.svelte";
import { assignmentListPageData } from "./page.svelte.spec/data";

describe("/editor/assignments +page.svelte", () => {
	it("marks assignments that own an agent", async () => {
		render(Page, { props: { data: assignmentListPageData, form: null } });

		await expect.element(page.getByText("AGENT ZUGEWIESEN")).toBeVisible();
		await expect
			.element(page.getByRole("link", { name: "Bearbeiten" }).first())
			.toHaveAttribute("href", "/editor/assignments/1");
		await expect
			.element(page.getByRole("link", { name: "Schaufenster" }).first())
			.toHaveAttribute("href", "/showcase/innenstadt");
	});

	it("renders assignments without agents without an ownership badge", async () => {
		const data = {
			...assignmentListPageData,
			assignments: [assignmentListPageData.assignments[1]],
		};
		render(Page, { props: { data, form: null } });

		await expect.element(page.getByText("Bahnhof", { exact: true })).toBeVisible();
		await expect.element(page.getByText("AGENT ZUGEWIESEN")).not.toBeInTheDocument();
	});
});
