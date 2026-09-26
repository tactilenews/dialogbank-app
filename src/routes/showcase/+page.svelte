<script lang="ts">
import { resolve } from "$app/paths";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Schaufenster | Dialogbank</title>
</svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
	<h1 class="text-3xl font-bold text-gray-900">Einsatz auswählen</h1>
	{#if data.availableAssignments.length > 0}
		<div class="mt-8 flex w-full max-w-xl flex-col gap-3">
			{#each data.availableAssignments as assignment (assignment.slug)}
				<a
					href={resolve(`/showcase/${assignment.slug}`)}
					class="flex items-center justify-between rounded-lg border border-gray-300 bg-white px-5 py-4 shadow-sm transition hover:bg-gray-100"
				>
					<span class="font-semibold text-gray-900">{assignment.name}</span>
					{#if assignment.location}
						<span class="text-sm text-gray-500">{assignment.location}</span>
					{/if}
				</a>
			{/each}
		</div>
	{:else}
		<p class="mt-6 text-lg text-gray-500">Derzeit ist kein Einsatz verfügbar.</p>
	{/if}
</div>
