import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import Page from "./+page.svelte";

const availableAssignments = [
	{ name: "Gelsenkirchen", slug: "gelsenkirchen", location: "Gelsenkirchen" },
	{ name: "Köln", slug: "koeln", location: null },
];

describe("/+page.svelte", () => {
	it("lets visitors choose an available assignment", async () => {
		render(Page, { props: { data: { user: null, availableAssignments } } });

		await expect.element(page.getByRole("heading", { name: "DialogBank" })).toBeInTheDocument();
		await expect
			.element(page.getByRole("link", { name: "Gelsenkirchen Gelsenkirchen" }))
			.toHaveAttribute("href", "/showcase/gelsenkirchen");
		await expect
			.element(page.getByRole("link", { name: "Köln" }))
			.toHaveAttribute("href", "/showcase/koeln");
		await expect.element(page.getByRole("link", { name: "Anmelden" })).toBeVisible();
	});

	it("shows an empty state when no assignment is available", async () => {
		render(Page, { props: { data: { user: null, availableAssignments: [] } } });

		await expect.element(page.getByText("Derzeit ist kein Einsatz verfügbar.")).toBeVisible();
	});

	it("displays editor links for authenticated users", async () => {
		render(Page, {
			props: { data: { user: { id: "user-1" }, availableAssignments } },
		});

		await expect
			.element(page.getByRole("link", { name: "Einsätze" }))
			.toHaveAttribute("href", "/editor/assignments");
		await expect
			.element(page.getByRole("link", { name: "Auswertung" }))
			.toHaveAttribute("href", "/editor/dashboard");
		await expect.element(page.getByRole("link", { name: "Anmelden" })).not.toBeInTheDocument();
	});
});
