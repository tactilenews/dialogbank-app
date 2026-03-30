<script lang="ts">
import type { DashboardConversationDay } from "./types";

type Props = {
	conversationsPerDay: DashboardConversationDay[];
};

let { conversationsPerDay }: Props = $props();

const maxConversations = $derived(Math.max(1, ...conversationsPerDay.map((item) => item.count)));
</script>

<section class="space-y-4">
	<div class="flex items-center justify-between">
		<h2 class="text-xl font-semibold text-slate-900">Gespräche pro Tag</h2>
		<span class="text-xs uppercase tracking-[0.2em] text-slate-400">Letzte Einträge</span>
	</div>

	{#if conversationsPerDay.length === 0}
		<div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-slate-500">
			Es wurden noch keine Gespräche erfasst.
		</div>
	{:else}
		<div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
			<div class="flex items-end gap-3 overflow-x-auto pb-2">
				{#each conversationsPerDay as day (day.day)}
					<div class="flex w-16 flex-col items-center gap-2">
						<div
							class="w-full rounded-full bg-slate-900/80"
							style={`height: ${Math.max(12, (day.count / maxConversations) * 160)}px`}
							title={`${day.count} Gespräche am ${day.day}`}
						></div>
						<div class="text-[0.7rem] text-slate-500">{day.day}</div>
						<div class="text-sm font-medium text-slate-700">{day.count}</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</section>
