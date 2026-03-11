import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import Page from "./+page.svelte";

describe("/+page.svelte", () => {
	it("displays the page header and navigation", async () => {
		render(Page, { props: { data: { user: null, answers: [] } } });

		// Check for main heading
		const heading = page.getByRole("heading", { name: "DialogBank" });
		await expect.element(heading).toBeInTheDocument();

		// Check for description
		const description = page.getByText("This is a public page for DialogBank.");
		await expect.element(description).toBeVisible();

		// Check for Agent Explorer button
		const agentExplorerLink = page.getByRole("link", { name: "Go to Agent Explorer" });
		await expect.element(agentExplorerLink).toBeVisible();
	});

	it("displays sign in button when not authenticated", async () => {
		render(Page, { props: { data: { user: null, answers: [] } } });

		// Should show Sign in button
		const signInButton = page.getByRole("link", { name: "Sign in" });
		await expect.element(signInButton).toBeVisible();
	});

	it("agent explorer link has correct href", async () => {
		render(Page, { props: { data: { user: null, answers: [] } } });

		const agentExplorerLink = page.getByRole("link", { name: "Go to Agent Explorer" });
		await expect.element(agentExplorerLink).toHaveAttribute("href", "/dialogbank");
	});
});
