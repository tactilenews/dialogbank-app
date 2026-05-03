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

	<div class="mt-8 flex items-center gap-4">
		<a
			href={resolve('/showcase')}
			class="rounded-lg border border-gray-300 bg-white px-6 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 focus:outline-none"
		>
			Aktives Schaufenster
		</a>
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
