<script lang="ts">
import type { SubmitFunction } from "@sveltejs/kit";
import { enhance } from "$app/forms";
import type { DashboardClassificationSummary, DashboardForm } from "./types";

type Props = {
	classificationOptions: DashboardClassificationSummary[];
	form: DashboardForm;
};

let { classificationOptions, form }: Props = $props();

const enhanceInvalidate = (() => {
	return async ({ update }) => {
		await update({ invalidateAll: true, reset: true });
	};
}) satisfies SubmitFunction;

const warning = $derived(form && "classificationWarning" in form ? form : undefined);
const statusMessage = $derived(form && "classificationMessage" in form ? form : undefined);
</script>

<section class="space-y-4">
	<h2 class="text-xl font-semibold text-slate-900">Klassifizierungen verwalten</h2>

	{#if warning}
		<div class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
			<p>{warning.classificationWarning}</p>
			<form method="POST" action="?/deleteClassification" use:enhance={enhanceInvalidate} class="mt-3">
				<input type="hidden" name="id" value={warning.confirmDeleteId} />
				<input type="hidden" name="confirmed" value="true" />
				<button
					type="submit"
					class="rounded-lg border border-amber-400 bg-amber-100 px-4 py-2 text-xs font-medium text-amber-900 hover:bg-amber-200"
				>
					Trotzdem löschen
				</button>
			</form>
		</div>
	{/if}

	{#if statusMessage}
		<p class="text-sm {statusMessage.classificationSuccess ? 'text-emerald-700' : 'text-rose-700'}">
			{statusMessage.classificationMessage}
		</p>
	{/if}

	<div class="overflow-hidden rounded-xl border border-slate-200">
		<table class="w-full text-sm">
			<thead>
				<tr class="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
					<th class="px-4 py-3">Key</th>
					<th class="px-4 py-3">Bezeichnung</th>
					<th class="px-4 py-3 text-right">Antworten</th>
					<th class="px-4 py-3"></th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#each classificationOptions as option (option.id)}
					<tr class="bg-white">
						<td class="px-4 py-3 font-mono text-xs text-slate-500">{option.key}</td>
						<td class="px-4 py-3">
							<form method="POST" action="?/updateClassification" use:enhance={enhanceInvalidate} class="flex items-center gap-2">
								<input type="hidden" name="id" value={option.id} />
								<input
									type="text"
									name="label"
									value={option.label}
									required
									class="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm text-slate-700"
								/>
								<button
									type="submit"
									class="shrink-0 rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
								>
									Speichern
								</button>
							</form>
						</td>
						<td class="px-4 py-3 text-right text-slate-500">{option.answerCount}</td>
						<td class="px-4 py-3 text-right">
							<form method="POST" action="?/deleteClassification" use:enhance={enhanceInvalidate}>
								<input type="hidden" name="id" value={option.id} />
								<button
									type="submit"
									class="rounded-lg border border-slate-200 px-3 py-1 text-xs text-rose-600 hover:bg-rose-50"
								>
									Löschen
								</button>
							</form>
						</td>
					</tr>
				{/each}
				{#if classificationOptions.length === 0}
					<tr>
						<td colspan="4" class="px-4 py-6 text-center text-slate-400">
							Noch keine Klassifizierungen vorhanden.
						</td>
					</tr>
				{/if}
			</tbody>
		</table>
	</div>

	<form method="POST" action="?/createClassification" use:enhance={enhanceInvalidate} class="flex items-center gap-3">
		<input
			type="text"
			name="label"
			placeholder="Neue Klassifizierung…"
			required
			class="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400"
		/>
		<button
			type="submit"
			class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
		>
			Anlegen
		</button>
	</form>
</section>
