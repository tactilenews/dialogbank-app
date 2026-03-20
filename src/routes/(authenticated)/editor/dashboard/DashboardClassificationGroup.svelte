<script lang="ts">
import DashboardAnswerCard from "./DashboardAnswerCard.svelte";
import type {
	DashboardClassificationGroup as ClassificationGroup,
	DashboardClassificationOption,
	DashboardForm,
} from "./types";

type Props = {
	group: ClassificationGroup;
	classificationOptions: DashboardClassificationOption[];
	form: DashboardForm;
};

let { group, classificationOptions, form }: Props = $props();
</script>

<div
	id={`classification-${group.key}`}
	data-testid={`classification-${group.key}`}
	class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
>
	<div class="flex items-center justify-between">
		<div>
			<h3 class="text-lg font-semibold text-slate-900">{group.classification}</h3>
			<p class="text-sm text-slate-500">Page {group.pagination.page} of {group.pagination.totalPages}</p>
		</div>
	</div>
	<div class="mt-4 space-y-3">
		{#each group.answers as answer (answer.id)}
			<DashboardAnswerCard {answer} {classificationOptions} {form} />
		{/each}
	</div>
	<nav class="mt-4 flex items-center justify-between" aria-label={`${group.classification} pagination`}>
		<a
			data-sveltekit-noscroll
			data-sveltekit-reload
			data-testid={`pagination-${group.key}-previous`}
			class={`rounded-full border px-4 py-2 text-sm font-medium ${
				group.pagination.page <= 1
					? "pointer-events-none border-slate-200 text-slate-300"
					: "border-slate-300 text-slate-700 hover:border-slate-400"
			}`}
			href={`?page_${group.key}=${Math.max(1, group.pagination.page - 1)}#classification-${group.key}`}
		>
			Previous
		</a>
		<a
			data-sveltekit-noscroll
			data-sveltekit-reload
			data-testid={`pagination-${group.key}-next`}
			class={`rounded-full border px-4 py-2 text-sm font-medium ${
				group.pagination.page >= group.pagination.totalPages
					? "pointer-events-none border-slate-200 text-slate-300"
					: "border-slate-300 text-slate-700 hover:border-slate-400"
			}`}
			href={`?page_${group.key}=${Math.min(group.pagination.totalPages, group.pagination.page + 1)}#classification-${group.key}`}
		>
			Next
		</a>
	</nav>
</div>
