<script lang="ts">
import type { ActionData, PageData } from "./$types";
import DashboardClassificationGroup from "./DashboardClassificationGroup.svelte";
import DashboardConversationChart from "./DashboardConversationChart.svelte";
import DashboardSummaryStats from "./DashboardSummaryStats.svelte";
import type { DashboardStatItem } from "./types";

export let data: PageData;
export let form: ActionData | undefined = undefined;

$: classificationGroups = data.classificationGroups ?? [];
$: classificationOptions = data.classificationOptions ?? [];

$: statItems = [
	{
		label: "Successful conversations",
		value: data.successfulConversations,
	},
	{
		label: "Total answers",
		value: data.totalAnswers,
	},
] satisfies DashboardStatItem[];
</script>

<svelte:head>
	<title>Editor Dashboard | Dialogbank</title>
</svelte:head>

<div class="space-y-10">
	<header class="space-y-2">
		<p class="text-sm uppercase tracking-[0.2em] text-slate-500">Editor dashboard</p>
		<h1 class="text-3xl font-semibold text-slate-900">Answer overview</h1>
		<p class="text-slate-600">A focused view of conversation health and answer coverage.</p>
	</header>

	<DashboardSummaryStats {statItems} />

	<DashboardConversationChart conversationsPerDay={data.conversationsPerDay} />

	<section class="space-y-6">
		<div class="flex flex-wrap items-center justify-between gap-4">
			<h2 class="text-xl font-semibold text-slate-900">Answer classifications</h2>
		</div>

		{#if classificationGroups.length === 0}
			<div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-slate-500">
				No answers are available yet.
			</div>
		{:else}
			<div class="grid gap-6">
				{#each classificationGroups as group}
					<DashboardClassificationGroup {group} {classificationOptions} {form} />
				{/each}
			</div>
		{/if}
	</section>
</div>
