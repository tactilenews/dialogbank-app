import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import Page from "./+page.svelte";
import { assignmentEditorPageData } from "./page.svelte.spec/data";

describe("/editor/assignments/[id] +page.svelte", () => {
	it("groups agents by availability and labels the configure action", async () => {
		render(Page, { props: { data: assignmentEditorPageData, form: {} } });

		const agentSelect = page.getByRole("combobox", { name: "Agent" });
		await expect.element(agentSelect).toHaveValue("agent_current");
		expect(document.querySelector('optgroup[label="Kein Agent"]')).not.toBeNull();
		expect(document.querySelector('optgroup[label="Nicht verfügbare Agenten"]')).not.toBeNull();
		await expect.element(page.getByRole("option", { name: "Tom — Bahnhof" })).toBeDisabled();
		expect(document.querySelector('optgroup[label="Verfügbare Agenten"]')).not.toBeNull();
		await expect.element(page.getByRole("button", { name: "Nadia konfigurieren" })).toBeEnabled();
	});
});
