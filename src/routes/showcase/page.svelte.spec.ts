import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import Page from "./+page.svelte";

describe("/showcase +page.svelte (fallback)", () => {
	it("shows a message when no active assignment is configured", async () => {
		render(Page);

		const message = page.getByText("Kein aktiver Einsatz konfiguriert.");
		await expect.element(message).toBeVisible();
	});
});
