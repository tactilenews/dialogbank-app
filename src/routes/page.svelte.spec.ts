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

		const dialogbankLink = page.getByRole("link", { name: "DialogBank" });
		await expect.element(dialogbankLink).toHaveAttribute("href", "/dialogbank");

		const signInButton = page.getByRole("link", { name: "Sign in" });
		await expect.element(signInButton).toBeVisible();
	});

	it("displays sign in button when not authenticated", async () => {
		render(Page, { props: { data: { user: null, answers: [] } } });

		const signInButton = page.getByRole("link", { name: "Sign in" });
		await expect.element(signInButton).toBeVisible();
		await expect
			.element(page.getByRole("link", { name: "DialogBank" }))
			.toHaveAttribute("href", "/dialogbank");
		await expect.element(page.getByRole("link", { name: "Editor Agent" })).not.toBeInTheDocument();
		await expect
			.element(page.getByRole("link", { name: "Editor Dashboard" }))
			.not.toBeInTheDocument();
	});

	it("displays direct editor links when authenticated", async () => {
		render(Page, {
			props: { data: { user: { id: "user-1" }, answers: [] } },
		});

		const agentExplorerLink = page.getByRole("link", { name: "Editor Agent" });
		await expect.element(agentExplorerLink).toHaveAttribute("href", "/editor/agent");

		const dashboardLink = page.getByRole("link", { name: "Editor Dashboard" });
		await expect.element(dashboardLink).toHaveAttribute("href", "/editor/dashboard");
		await expect
			.element(page.getByRole("link", { name: "DialogBank" }))
			.toHaveAttribute("href", "/dialogbank");
		await expect.element(page.getByRole("link", { name: "Sign in" })).not.toBeInTheDocument();
	});
});
