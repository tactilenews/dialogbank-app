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

	it("submits the agent selection with the assignment form", async () => {
		render(Page, { props: { data: assignmentEditorPageData, form: {} } });

		await expect
			.element(page.getByRole("combobox", { name: "Agent" }))
			.toHaveAttribute("form", "assignment-form");
	});

	it("offers no reconfiguration while the agent is up to date, since saving updates it", async () => {
		render(Page, { props: { data: assignmentEditorPageData, form: {} } });

		await expect.element(page.getByText("Nadia ist verbunden.", { exact: false })).toBeVisible();
		await expect
			.element(page.getByRole("button", { name: "Nadia neu konfigurieren" }))
			.not.toBeInTheDocument();
	});

	it.each([
		["the last configuration failed", { agentConfigurationError: "ElevenLabs unavailable" }],
		["the assignment changed after it", { updatedAt: new Date("2026-09-21T00:00:00.000Z") }],
		["it was never configured", { agentConfiguredAt: null }],
	])("offers reconfiguring the agent when %s", async (_, assignment) => {
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
			.element(page.getByRole("button", { name: "Nadia neu konfigurieren" }))
			.toBeEnabled();
	});

	it("shows configuration errors and the concurrency warning", async () => {
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
		await expect
			.element(page.getByText(/nicht gleichzeitig in mehreren Browserfenstern/))
			.toBeVisible();
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
