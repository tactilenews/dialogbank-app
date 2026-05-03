<script lang="ts">
import type { SubmitFunction } from "@sveltejs/kit";
import { enhance } from "$app/forms";
import type { DashboardAnswer, DashboardClassificationOption, DashboardForm } from "./types";

type Props = {
	answer: DashboardAnswer;
	classificationOptions: DashboardClassificationOption[];
	form: DashboardForm;
};

let { answer, classificationOptions, form }: Props = $props();

const enhanceClassificationForm = (() => {
	return async ({ update }) => {
		await update({ invalidateAll: true, reset: false });
	};
}) satisfies SubmitFunction;

const matchingForm = $derived(
	form != null && "answerId" in form && form.answerId === answer.id ? form : undefined,
);
</script>

<div class="rounded-xl border border-slate-100 bg-slate-50 p-4">
	<div class="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)] lg:items-start">
		<div class="min-w-0">
			<div class="text-sm font-medium text-slate-700">{answer.name}</div>
			<div class="mt-2 text-sm text-slate-600">{answer.value}</div>
			{#if answer.rationale}
				<div class="mt-3 rounded-xl border border-slate-200 bg-white/80 px-3 py-3">
					<div class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
						Begründung
					</div>
					<p data-testid={`answer-${answer.id}-rationale`} class="mt-3 text-sm leading-6 text-slate-600">
						{answer.rationale}
					</p>
				</div>
			{/if}
		</div>
		<form
			method="POST"
			action="?/classifyAnswer"
			use:enhance={enhanceClassificationForm}
			class="w-full space-y-2 lg:min-w-[18rem]"
		>
			<input type="hidden" name="answerId" value={answer.id} />
			<label
				for={`classification-select-${answer.id}`}
				class="block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500"
			>
				Klassifizierung
			</label>
			<select
				id={`classification-select-${answer.id}`}
				name="classificationId"
				value={answer.classificationId ?? ""}
				data-testid={`answer-${answer.id}-classification`}
				class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
			>
				<option value="">Nicht klassifiziert</option>
				{#each classificationOptions as option (option.id)}
					<option value={option.id}>{option.label}</option>
				{/each}
			</select>
			<div class="flex items-center justify-between gap-3">
				<div class="text-xs text-slate-500">Aktuell: {answer.classification}</div>
				<button
					type="submit"
					data-testid={`answer-${answer.id}-save`}
					class="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-400"
				>
					Speichern
				</button>
			</div>
			{#if matchingForm}
				<p class={`text-sm ${matchingForm.success ? "text-emerald-700" : "text-rose-700"}`}>
					{matchingForm.message}
				</p>
			{/if}
		</form>
	</div>
</div>
