import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import Page from "./+page.svelte";

describe("/+page.svelte", () => {
	it("displays the page header and navigation", async () => {
		render(Page, { props: { data: { user: null } } });

		// Check for main heading
		const heading = page.getByRole("heading", { name: "DialogBank" });
		await expect.element(heading).toBeInTheDocument();

		// Check for description
		const description = page.getByText("Dies ist die öffentliche Seite der DialogBank.");
		await expect.element(description).toBeVisible();

		const showcaseLink = page.getByRole("link", { name: "Aktives Schaufenster" });
		await expect.element(showcaseLink).toHaveAttribute("href", "/showcase");

		const signInButton = page.getByRole("link", { name: "Anmelden" });
		await expect.element(signInButton).toBeVisible();
	});

	it("displays sign in button when not authenticated", async () => {
		render(Page, { props: { data: { user: null } } });

		const signInButton = page.getByRole("link", { name: "Anmelden" });
		await expect.element(signInButton).toBeVisible();
		await expect
			.element(page.getByRole("link", { name: "Aktives Schaufenster" }))
			.toHaveAttribute("href", "/showcase");
		await expect.element(page.getByRole("link", { name: "Einsätze" })).not.toBeInTheDocument();
		await expect.element(page.getByRole("link", { name: "Auswertung" })).not.toBeInTheDocument();
	});

	it("displays direct editor links when authenticated", async () => {
		render(Page, {
			props: { data: { user: { id: "user-1" } } },
		});

		const einsaetzeLink = page.getByRole("link", { name: "Einsätze" });
		await expect.element(einsaetzeLink).toHaveAttribute("href", "/editor/assignments");

		const auswertungLink = page.getByRole("link", { name: "Auswertung" });
		await expect.element(auswertungLink).toHaveAttribute("href", "/editor/dashboard");
		await expect
			.element(page.getByRole("link", { name: "Aktives Schaufenster" }))
			.toHaveAttribute("href", "/showcase");
		await expect.element(page.getByRole("link", { name: "Anmelden" })).not.toBeInTheDocument();
	});
});
