<script lang="ts">
import { resolve } from "$app/paths";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Dialogbank</title>
</svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4 text-center">
	<h1 class="text-4xl font-extrabold text-gray-900">DialogBank</h1>
	<p class="mt-4 text-lg text-gray-600">Dies ist die öffentliche Seite der DialogBank.</p>

	{#if data.publishedAssignments.length > 0}
		<div class="mt-8 flex w-full max-w-xl flex-col gap-3">
			{#each data.publishedAssignments as assignment (assignment.slug)}
				<a
					href={resolve(`/showcase/${assignment.slug}`)}
					class="flex items-center justify-between rounded-lg border border-gray-300 bg-white px-5 py-4 text-left shadow-sm transition hover:bg-gray-100 focus:outline-none"
				>
					<span class="font-semibold text-gray-900">{assignment.name}</span>
					{#if assignment.location}
						<span class="text-sm text-gray-500">{assignment.location}</span>
					{/if}
				</a>
			{/each}
		</div>
	{:else}
		<p class="mt-8 text-sm text-gray-500">Derzeit ist kein Einsatz veröffentlicht.</p>
	{/if}

	<div class="mt-8 flex items-center gap-4">
		{#if data.user}
			<a
				href={resolve('/editor/assignments')}
				class="rounded-lg border border-gray-300 bg-white px-6 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 focus:outline-none"
			>
				Einsätze
			</a>
			<a
				href={resolve('/editor/dashboard')}
				class="rounded-lg border border-gray-300 bg-white px-6 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 focus:outline-none"
			>
				Auswertung
			</a>
		{:else}
			<a
				href={resolve('/auth/sign-in')}
				class="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none"
			>
				Anmelden
			</a>
		{/if}
	</div>
</div>
