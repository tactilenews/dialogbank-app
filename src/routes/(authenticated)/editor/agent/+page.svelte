<script lang="ts">
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Redaktions-Agent | Dialogbank</title>
</svelte:head>

<div class="max-w-3xl">
	<div class="mb-6">
		<h1 class="text-3xl font-bold">Redaktions-Agent</h1>
	</div>

	{#if data.agent}
		<div class="rounded-lg border bg-white p-6 shadow-md">
			<h2 class="mb-4 text-2xl font-semibold text-gray-800">
				{data.agent.name}
			</h2>

			<div class="mt-4">
				<h3 class="text-sm font-medium tracking-wider text-gray-500 uppercase">System-Prompt</h3>
				<div
					class="mt-2 rounded bg-gray-50 p-4 font-serif whitespace-pre-wrap text-gray-700 italic"
				>
					{data.agent.systemPrompt}
				</div>
			</div>

			<div class="mt-6 text-sm text-gray-400">
				Agent-ID: {data.agent.id} (Über die Umgebung konfiguriert)
			</div>
		</div>
	{:else}
		<div class="rounded-lg border border-dashed border-gray-300 p-12 text-center text-gray-500">
			Agentendetails konnten nicht geladen werden. Bitte stellen Sie sicher, dass
			ELEVENLABS_AGENT_ID und ELEVENLABS_API_KEY konfiguriert sind.
		</div>
	{/if}
</div>
