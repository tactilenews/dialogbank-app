import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import Page from "./+page.svelte";

describe("/showcase +page.svelte", () => {
	it("lets visitors choose an available assignment", async () => {
		render(Page, {
			props: {
				data: {
					user: null,
					availableAssignments: [
						{ name: "Gelsenkirchen", slug: "gelsenkirchen", location: "Gelsenkirchen" },
					],
				},
			},
		});

		await expect.element(page.getByRole("heading", { name: "Einsatz auswählen" })).toBeVisible();
		await expect
			.element(page.getByRole("link", { name: "Gelsenkirchen Gelsenkirchen" }))
			.toHaveAttribute("href", "/showcase/gelsenkirchen");
	});

	it("shows a message when no assignment is available", async () => {
		render(Page, { props: { data: { user: null, availableAssignments: [] } } });

		await expect.element(page.getByText("Derzeit ist kein Einsatz verfügbar.")).toBeVisible();
	});
});
