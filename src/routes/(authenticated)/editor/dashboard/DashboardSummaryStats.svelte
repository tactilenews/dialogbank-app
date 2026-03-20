<script lang="ts">
import type { DashboardStatItem } from "./types";

type Props = {
	statItems: DashboardStatItem[];
};

let { statItems }: Props = $props();
</script>

<section class="grid gap-6 md:grid-cols-2" aria-label="Summary statistics">
	{#each statItems as item (item.label)}
		<div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
			<div class="text-sm text-slate-500">{item.label}</div>
			<div class="mt-4 text-3xl font-semibold text-slate-900">{item.value}</div>
		</div>
	{/each}
</section>
