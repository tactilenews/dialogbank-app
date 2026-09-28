import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import Page from "./+page.svelte";
import { assignmentEditorPageData } from "./page.svelte.spec/data";

describe("/editor/assignments/[id] +page.svelte", () => {
	it("groups agents in the agent panel", async () => {
		render(Page, { props: { data: assignmentEditorPageData, form: {} } });

		const agentSelect = page.getByRole("combobox", { name: "Agent" });
		await expect.element(agentSelect).toHaveValue("agent_current");
		expect(document.querySelector('optgroup[label="Kein Agent"]')).not.toBeNull();
		expect(document.querySelector('optgroup[label="Nicht verfügbare Agenten"]')).not.toBeNull();
		await expect.element(page.getByRole("option", { name: "Tom — Bahnhof" })).toBeDisabled();
		expect(document.querySelector('optgroup[label="Verfügbare Agenten"]')).not.toBeNull();
	});

	it("selects the agent in the assignment form, above its only submit button", async () => {
		render(Page, { props: { data: assignmentEditorPageData, form: {} } });

		const form = document.querySelector("form");
		const agentSelect = form?.querySelector('select[name="elevenLabsAgentId"]');
		const submitButtons = document.querySelectorAll('button[type="submit"]');
		expect(submitButtons).toHaveLength(1);
		expect(agentSelect).not.toBeNull();
		expect(agentSelect?.compareDocumentPosition(submitButtons[0]) ?? 0).toBe(
			Node.DOCUMENT_POSITION_FOLLOWING,
		);
		await expect.element(page.getByRole("button", { name: "Speichern" })).toBeEnabled();
	});

	it("says nothing about updating an agent that is up to date", async () => {
		render(Page, { props: { data: assignmentEditorPageData, form: {} } });

		await expect
			.element(page.getByText("Speichern aktualisiert ihn.", { exact: false }))
			.not.toBeInTheDocument();
	});

	it.each([
		["the last configuration failed", { agentConfigurationError: "ElevenLabs unavailable" }],
		["the assignment changed after it", { updatedAt: new Date("2026-09-21T00:00:00.000Z") }],
		["it was never configured", { agentConfiguredAt: null }],
	])("points out that saving updates the agent when %s", async (_, assignment) => {
		render(Page, {
			props: {
				data: {
					...assignmentEditorPageData,
					assignment: { ...assignmentEditorPageData.assignment, ...assignment },
				},
				form: {},
			},
		});

		await expect
			.element(page.getByText("Speichern aktualisiert ihn.", { exact: false }))
			.toBeVisible();
	});

	it("shows configuration errors", async () => {
		render(Page, {
			props: {
				data: {
					...assignmentEditorPageData,
					assignment: {
						...assignmentEditorPageData.assignment,
						agentConfigurationError: "ElevenLabs unavailable",
					},
				},
				form: {},
			},
		});

		await expect.element(page.getByText("ElevenLabs unavailable")).toBeVisible();
	});

	it("reports a catalog that failed to load instead of calling it empty", async () => {
		render(Page, {
			props: {
				data: {
					...assignmentEditorPageData,
					availableAgents: [],
					unavailableAgents: [],
					agentCatalogError: "ElevenLabs unavailable",
				},
				form: {},
			},
		});

		await expect
			.element(page.getByText("Agentenkatalog konnte nicht geladen werden: ElevenLabs unavailable"))
			.toBeVisible();
		await expect
			.element(page.getByText("Keine Dialogbank-Agenten gefunden.", { exact: false }))
			.not.toBeInTheDocument();
		await expect
			.element(page.getByRole("option", { name: "agent_current", exact: true }))
			.toBeInTheDocument();
	});
});
