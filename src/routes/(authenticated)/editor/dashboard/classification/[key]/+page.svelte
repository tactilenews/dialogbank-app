<script lang="ts">
import { resolve } from "$app/paths";
import DashboardAnswerCard from "../../DashboardAnswerCard.svelte";
import type { ActionData, PageData } from "./$types";

export let data: PageData;
export let form: ActionData | undefined = undefined;
</script>

<svelte:head>
	<title>{data.classification.label} | Auswertung | Dialogbank</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center gap-3">
		<a href={resolve("/editor/dashboard")} class="text-sm text-slate-500 hover:text-slate-900">
			← Auswertung
		</a>
	</div>

	<header class="space-y-1">
		<p class="text-sm uppercase tracking-[0.2em] text-slate-500">Klassifizierung</p>
		<h1 class="text-3xl font-semibold text-slate-900">{data.classification.label}</h1>
		<p class="text-sm text-slate-500">
			{data.answers.length} Antwort{data.answers.length === 1 ? "" : "en"}
		</p>
	</header>

	{#if data.answers.length === 0}
		<div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-slate-400">
			Keine Antworten in dieser Klassifizierung.
		</div>
	{:else}
		<div class="space-y-3">
			{#each data.answers as answer (answer.id)}
				<DashboardAnswerCard {answer} classificationOptions={data.classificationOptions} {form} />
			{/each}
		</div>
	{/if}
</div>
