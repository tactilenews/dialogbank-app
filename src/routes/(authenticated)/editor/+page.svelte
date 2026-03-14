<script lang="ts">
import type { PageData } from "./$types";

export let data: PageData;

type AnswerItem = (typeof data.answers)[number];

type ClassificationGroup = {
	classification: string;
	answers: AnswerItem[];
	count: number;
};

let classificationGroups: ClassificationGroup[] = [];

$: classificationGroups = groupAnswers(data.answers);
$: maxConversations = Math.max(1, ...data.conversationsPerDay.map((item) => item.count));

function groupAnswers(answers: AnswerItem[]): ClassificationGroup[] {
	const groupMap = new Map<string, AnswerItem[]>();

	for (const answer of answers) {
		const key = answer.classification || "Unclassified";
		const bucket = groupMap.get(key) ?? [];
		bucket.push(answer);
		groupMap.set(key, bucket);
	}

	return Array.from(groupMap.entries()).map(([classification, groupedAnswers]) => ({
		classification,
		answers: groupedAnswers,
		count: groupedAnswers.length,
	}));
}

const statItems = [
	{
		label: "Successful conversations",
		value: data.successfulConversations,
	},
	{
		label: "Total answers",
		value: data.totalAnswers,
	},
];
</script>

<div class="space-y-10">
	<header class="space-y-2">
		<p class="text-sm uppercase tracking-[0.2em] text-slate-500">Editor dashboard</p>
		<h1 class="text-3xl font-semibold text-slate-900">Answer overview</h1>
		<p class="text-slate-600">A focused view of conversation health and answer coverage.</p>
	</header>

	<section class="grid gap-6 md:grid-cols-2" aria-label="Summary statistics">
		{#each statItems as item}
			<div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
				<div class="text-sm text-slate-500">{item.label}</div>
				<div class="mt-4 text-3xl font-semibold text-slate-900">{item.value}</div>
			</div>
		{/each}
	</section>

	<section class="space-y-4">
		<div class="flex items-center justify-between">
			<h2 class="text-xl font-semibold text-slate-900">Conversations per day</h2>
			<span class="text-xs uppercase tracking-[0.2em] text-slate-400">Last entries</span>
		</div>

		{#if data.conversationsPerDay.length === 0}
			<div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-slate-500">
				No conversations have been recorded yet.
			</div>
		{:else}
			<div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
				<div class="flex items-end gap-3 overflow-x-auto pb-2">
					{#each data.conversationsPerDay as day}
						<div class="flex w-16 flex-col items-center gap-2">
							<div
								class="w-full rounded-full bg-slate-900/80"
								style={`height: ${Math.max(12, (day.count / maxConversations) * 160)}px`}
								title={`${day.count} conversations on ${day.day}`}
							></div>
							<div class="text-[0.7rem] text-slate-500">{day.day}</div>
							<div class="text-sm font-medium text-slate-700">{day.count}</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</section>

	<section class="space-y-6">
		<div class="flex flex-wrap items-center justify-between gap-4">
			<h2 class="text-xl font-semibold text-slate-900">Answer classifications</h2>
			<div class="text-sm text-slate-500">
				Page {data.pagination.page} of {data.pagination.totalPages}
			</div>
		</div>

		{#if classificationGroups.length === 0}
			<div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-slate-500">
				No answers are available yet.
			</div>
		{:else}
			<div class="grid gap-6">
				{#each classificationGroups as group}
					<div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
						<div class="flex items-center justify-between">
							<div>
								<h3 class="text-lg font-semibold text-slate-900">{group.classification}</h3>
								<p class="text-sm text-slate-500">{group.count} answers on this page</p>
							</div>
						</div>
						<div class="mt-4 space-y-3">
							{#each group.answers as answer}
								<div class="rounded-xl border border-slate-100 bg-slate-50 p-4">
									<div class="text-sm font-medium text-slate-700">{answer.name}</div>
									<div class="mt-2 text-sm text-slate-600">{answer.value}</div>
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		{/if}

		<nav class="flex items-center justify-between" aria-label="Pagination">
			<a
				class={`rounded-full border px-4 py-2 text-sm font-medium ${
					data.pagination.page <= 1
						? "pointer-events-none border-slate-200 text-slate-300"
						: "border-slate-300 text-slate-700 hover:border-slate-400"
				}`}
				href={`?page=${Math.max(1, data.pagination.page - 1)}`}
			>
				Previous
			</a>
			<a
				class={`rounded-full border px-4 py-2 text-sm font-medium ${
					data.pagination.page >= data.pagination.totalPages
						? "pointer-events-none border-slate-200 text-slate-300"
						: "border-slate-300 text-slate-700 hover:border-slate-400"
				}`}
				href={`?page=${Math.min(data.pagination.totalPages, data.pagination.page + 1)}`}
			>
				Next
			</a>
		</nav>
	</section>
</div>
