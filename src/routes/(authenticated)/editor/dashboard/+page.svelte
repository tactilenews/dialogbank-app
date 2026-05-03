<script lang="ts">
import { resolve } from "$app/paths";
import type { ActionData, PageData } from "./$types";
import DashboardClassificationManager from "./DashboardClassificationManager.svelte";
import DashboardConversationChart from "./DashboardConversationChart.svelte";
import DashboardSummaryStats from "./DashboardSummaryStats.svelte";
import type { DashboardStatItem } from "./types";

export let data: PageData;
export let form: ActionData | undefined = undefined;

$: classificationOptions = data.classificationOptions ?? [];

$: statItems = [
	{
		label: "Erfolgreiche Gespräche",
		value: data.successfulConversations,
	},
	{
		label: "Antworten insgesamt",
		value: data.totalAnswers,
	},
] satisfies DashboardStatItem[];
</script>

<svelte:head>
	<title>Auswertung | Dialogbank</title>
</svelte:head>

<div class="space-y-10">
	<header class="space-y-2">
		<p class="text-sm uppercase tracking-[0.2em] text-slate-500">Auswertung</p>
		<h1 class="text-3xl font-semibold text-slate-900">Antworten im Überblick</h1>
		<p class="text-slate-600">Fokussierte Ansicht auf Gesprächsqualität und Antwortabdeckung.</p>
	</header>

	<DashboardSummaryStats {statItems} />

	<DashboardConversationChart conversationsPerDay={data.conversationsPerDay} />

	<section class="space-y-4">
		<h2 class="text-xl font-semibold text-slate-900">Antwortklassifizierungen</h2>

		<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{#each classificationOptions as option (option.id)}
				<a
					href={resolve(`/editor/dashboard/classification/${option.key}`)}
					data-testid="classification-card-{option.key}"
					class="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-400 hover:shadow"
				>
					<span class="text-base font-semibold text-slate-900">{option.label}</span>
					<span class="mt-1 font-mono text-xs text-slate-400">{option.key}</span>
					<span class="mt-3 text-2xl font-bold text-slate-700">{option.answerCount}</span>
					<span class="text-xs text-slate-400">Antwort{option.answerCount === 1 ? "" : "en"}</span>
				</a>
			{/each}

			<!-- Nicht klassifiziert – always shown, not deletable -->
			<a
				href={resolve("/editor/dashboard/classification/unclassified")}
				data-testid="classification-card-unclassified"
				class="flex flex-col rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 shadow-sm transition hover:border-slate-400"
			>
				<span class="text-base font-semibold text-slate-500">Nicht klassifiziert</span>
				<span class="mt-1 font-mono text-xs text-slate-300">unclassified</span>
				<span class="mt-3 text-2xl font-bold text-slate-500">{data.unclassifiedCount}</span>
				<span class="text-xs text-slate-400">Antwort{data.unclassifiedCount === 1 ? "" : "en"}</span>
			</a>
		</div>
	</section>

	<DashboardClassificationManager {classificationOptions} {form} />
</div>
