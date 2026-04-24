<script lang="ts">
import { untrack } from "svelte";
import { enhance } from "$app/forms";
import { slugify } from "$lib/slugify";

type Question = { text: string; classifications: string[] };
type FormResult = { success?: boolean; message?: string } | null | undefined;

let {
	questions: initialQuestions,
	form,
}: {
	questions: Question[];
	form: FormResult;
} = $props();

let nextId = $state(0);
let submitting = $state(false);

type ClassificationItem = { id: number; value: string };
type QuestionItem = { id: number; text: string; classifications: ClassificationItem[] };

let questions = $state<QuestionItem[]>(
	untrack(() =>
		initialQuestions.map((q) => ({
			id: nextId++,
			text: q.text,
			classifications: q.classifications.map((v) => ({ id: nextId++, value: v })),
		})),
	),
);

function addQuestion() {
	questions.push({ id: nextId++, text: "", classifications: [] });
}

function removeQuestion(id: number) {
	const idx = questions.findIndex((q) => q.id === id);
	if (idx !== -1) questions.splice(idx, 1);
}

function addClassification(questionId: number) {
	const q = questions.find((q) => q.id === questionId);
	q?.classifications.push({ id: nextId++, value: "" });
}

function removeClassification(questionId: number, classId: number) {
	const q = questions.find((q) => q.id === questionId);
	if (!q) return;
	const idx = q.classifications.findIndex((c) => c.id === classId);
	if (idx !== -1) q.classifications.splice(idx, 1);
}
</script>

<div>
	<h3 class="mb-4 text-sm font-medium tracking-wider text-gray-500 uppercase">Fragen</h3>

	<form
		method="POST"
		use:enhance={() => {
			submitting = true;
			return ({ update }) => {
				update({ reset: false }).then(() => {
					submitting = false;
				});
			};
		}}
	>
		<fieldset disabled={submitting} class="min-w-0">
			<div class="flex flex-col gap-3">
				{#each questions as item, i (item.id)}
					<div class="rounded border border-gray-200 p-3 transition-opacity {submitting ? 'opacity-50' : ''}">
						<div class="flex items-center gap-2">
							<input
								type="text"
								name="questions"
								value={item.text}
								placeholder="Frage {i + 1}"
								class="flex-1 rounded border border-gray-300 px-3 py-2 text-sm disabled:cursor-not-allowed"
							/>
							<button
								type="button"
								aria-label="Frage {i + 1} entfernen"
								onclick={() => removeQuestion(item.id)}
								class="rounded border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed"
							>
								Entfernen
							</button>
						</div>

						<input
							type="hidden"
							name="question_classifications"
							value={JSON.stringify(item.classifications.map((c) => c.value))}
						/>

						<div class="mt-2 border-l-2 border-gray-200 pl-3">
							{#each item.classifications as cls (cls.id)}
								<div class="mt-1 flex items-start gap-2">
									<div class="flex-1">
										<input
											type="text"
											bind:value={cls.value}
											placeholder="Label"
											class="w-full rounded border border-gray-300 px-3 py-1.5 text-sm disabled:cursor-not-allowed"
										/>
										{#if cls.value.trim()}
											<div class="mt-0.5 font-mono text-xs text-gray-400">
												{slugify(cls.value)}
											</div>
										{/if}
									</div>
									<button
										type="button"
										aria-label="Klassifizierung entfernen"
										onclick={() => removeClassification(item.id, cls.id)}
										class="mt-0.5 rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed"
									>
										✕
									</button>
								</div>
							{/each}
							<button
								type="button"
								onclick={() => addClassification(item.id)}
								class="mt-1 text-sm text-gray-400 hover:text-gray-600 disabled:cursor-not-allowed"
							>
								+ Klassifizierung hinzufügen
							</button>
						</div>
					</div>
				{/each}
			</div>

			<button
				type="button"
				onclick={addQuestion}
				class="mt-4 rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed"
			>
				+ Frage hinzufügen
			</button>

			<div class="mt-4 flex items-center gap-3">
				<button
					type="submit"
					class="flex items-center gap-2 rounded bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
				>
					{#if submitting}
						<svg
							class="h-4 w-4 animate-spin"
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
						>
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
							></circle>
							<path
								class="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
							></path>
						</svg>
						Speichern…
					{:else}
						Speichern
					{/if}
				</button>

				{#if form?.message}
					<p class="text-sm {form.success ? 'text-green-600' : 'text-red-600'}">
						{form.message}
					</p>
				{/if}
			</div>
		</fieldset>
	</form>
</div>
