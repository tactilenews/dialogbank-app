import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import Page from "./+page.svelte";

describe("/showcase +page.svelte", () => {
	it("lets visitors choose a published assignment", async () => {
		render(Page, {
			props: {
				data: {
					user: null,
					publishedAssignments: [
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

	it("shows a message when no assignment is published", async () => {
		render(Page, { props: { data: { user: null, publishedAssignments: [] } } });

		await expect.element(page.getByText("Derzeit ist kein Einsatz veröffentlicht.")).toBeVisible();
	});
});
