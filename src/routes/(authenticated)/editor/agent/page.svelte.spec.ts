import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import AgentQuestionsForm from "$lib/components/AgentQuestionsForm.svelte";
import { sampleQuestions } from "./page.svelte.spec/data";

describe("AgentQuestionsForm", () => {
	it("renders existing questions as text inputs", async () => {
		render(AgentQuestionsForm, { props: { questions: sampleQuestions, form: undefined } });

		const inputs = page.getByRole("textbox");
		await expect.element(inputs.nth(0)).toHaveValue("Wie alt sind Sie?");
		await expect.element(inputs.nth(1)).toHaveValue("Was ist Ihr Beruf?");
	});

	it("question inputs carry name='questions' for form submission", async () => {
		render(AgentQuestionsForm, { props: { questions: sampleQuestions, form: undefined } });

		const inputs = page.getByRole("textbox");
		await expect.element(inputs.nth(0)).toHaveAttribute("name", "questions");
		await expect.element(inputs.nth(1)).toHaveAttribute("name", "questions");
	});

	it("shows no inputs when there are no questions", async () => {
		render(AgentQuestionsForm, { props: { questions: [], form: undefined } });

		await expect.element(page.getByRole("textbox")).not.toBeInTheDocument();
		await expect.element(page.getByRole("button", { name: "+ Frage hinzufügen" })).toBeVisible();
	});

	it("adds a new empty question input when the add button is clicked", async () => {
		render(AgentQuestionsForm, { props: { questions: [], form: undefined } });

		await page.getByRole("button", { name: "+ Frage hinzufügen" }).click();

		await expect.element(page.getByRole("textbox")).toBeVisible();
	});

	it("removes a question when its remove button is clicked", async () => {
		render(AgentQuestionsForm, { props: { questions: sampleQuestions, form: undefined } });

		await page.getByRole("button", { name: "Frage 1 entfernen" }).click();

		const inputs = page.getByRole("textbox");
		await expect.element(inputs.nth(0)).toHaveValue("Was ist Ihr Beruf?");
	});

	it("shows a success message when the form action succeeds", async () => {
		render(AgentQuestionsForm, {
			props: {
				questions: sampleQuestions,
				form: { success: true, message: "Fragen wurden gespeichert." },
			},
		});

		await expect.element(page.getByText("Fragen wurden gespeichert.")).toBeVisible();
	});

	it("shows an error message when the form action fails", async () => {
		render(AgentQuestionsForm, {
			props: {
				questions: sampleQuestions,
				form: { success: false, message: "Fragen konnten nicht gespeichert werden." },
			},
		});

		await expect.element(page.getByText("Fragen konnten nicht gespeichert werden.")).toBeVisible();
	});
});
