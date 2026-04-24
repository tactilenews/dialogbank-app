<script lang="ts">
import type { LiteralJsonSchemaProperty } from "@elevenlabs/elevenlabs-js/api";
import AgentQuestionsForm from "$lib/components/AgentQuestionsForm.svelte";
import type { ActionData, PageData } from "./$types";

let { data, form }: { data: PageData; form: ActionData } = $props();

function sortedDataCollectionEntries(
	dc: Record<string, LiteralJsonSchemaProperty>,
): [string, LiteralJsonSchemaProperty][] {
	return Object.entries(dc).sort(([a], [b]) => a.localeCompare(b));
}
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
			<AgentQuestionsForm questions={data.agent.questions} {form} />

			<div class="mt-8 border-t border-gray-100 pt-6">
				<h3 class="mb-2 text-sm font-medium tracking-wider text-gray-500 uppercase">
					Workflow Node Prompt
				</h3>
				<pre class="rounded bg-gray-50 p-4 font-mono text-sm whitespace-pre-wrap text-gray-700">{data.agent.nodeAdditionalPrompt || "(leer)"}</pre>
			</div>

			<div class="mt-6">
				<h3 class="mb-2 text-sm font-medium tracking-wider text-gray-500 uppercase">
					Datenerfassung
				</h3>
				{#if Object.keys(data.agent.dataCollection).length === 0}
					<p class="text-sm text-gray-400">(keine Einträge)</p>
				{:else}
					<div class="flex flex-col gap-1">
						{#each sortedDataCollectionEntries(data.agent.dataCollection) as [key, entry]}
							<div class="rounded border border-gray-200 px-3 py-2 font-mono text-xs">
								<span class="font-semibold text-gray-800">{key}</span>
								<span class="ml-2 text-gray-400">{entry.type}</span>
								{#if entry.enum}
									<span class="ml-2 text-blue-600">[{entry.enum.join(", ")}]</span>
								{/if}
								{#if entry.description}
									<div class="mt-0.5 text-gray-500">{entry.description}</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<div class="mt-6 text-xs text-gray-400">
				Agent-ID: {data.agent.id} · Branch-ID: {data.agent.branchId ?? "–"}
			</div>
		</div>
	{:else}
		<div class="rounded-lg border border-dashed border-gray-300 p-12 text-center text-gray-500">
			Agentendetails konnten nicht geladen werden. Bitte stellen Sie sicher, dass
			ELEVENLABS_AGENT_ID und ELEVENLABS_API_KEY konfiguriert sind.
		</div>
	{/if}
</div>
