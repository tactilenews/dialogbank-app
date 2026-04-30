<script lang="ts">
import { enhance } from "$app/forms";
import { resolve } from "$app/paths";
import type { ActionData, PageData } from "./$types";

let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
	<title>Einsätze | Dialogbank</title>
</svelte:head>

<div class="max-w-3xl">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-3xl font-bold">Einsätze</h1>
	</div>

	<div class="mb-8 rounded-lg border bg-white p-6 shadow-md">
		<h2 class="mb-4 text-sm font-medium tracking-wider text-gray-500 uppercase">
			Neuen Einsatz erstellen
		</h2>
		<form method="POST" use:enhance class="flex items-start gap-3">
			<div class="flex-1">
				<input
					type="text"
					name="name"
					placeholder="Name des Einsatzes"
					required
					class="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
				/>
				{#if form?.message}
					<p class="mt-1 text-sm text-red-600">{form.message}</p>
				{/if}
			</div>
			<button
				type="submit"
				class="rounded bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
			>
				Erstellen
			</button>
		</form>
	</div>

	{#if data.assignments.length === 0}
		<div class="rounded-lg border border-dashed border-gray-300 p-12 text-center text-gray-500">
			Noch keine Einsätze vorhanden. Erstelle den ersten Einsatz oben.
		</div>
	{:else}
		<div class="flex flex-col gap-3">
			{#each data.assignments as assignment (assignment.id)}
				<div
					class="flex items-center justify-between rounded-lg border bg-white p-4 shadow-sm {assignment.isActive
						? 'border-green-300'
						: ''}"
				>
					<div class="min-w-0 flex-1">
						<div class="flex items-center gap-2">
							<span class="font-semibold text-gray-900">{assignment.name}</span>
							{#if assignment.isActive}
								<span
									class="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700"
								>
									AKTIV
								</span>
							{/if}
						</div>
						<div class="mt-0.5 flex flex-wrap gap-3 text-sm text-gray-500">
							<span>{assignment.questionCount} {assignment.questionCount === 1 ? 'Frage' : 'Fragen'}</span>
							{#if assignment.location}
								<span>· {assignment.location}</span>
							{/if}
							{#if assignment.client}
								<span>· {assignment.client}</span>
							{/if}
						</div>
					</div>
					<a
						href={resolve(`/editor/assignments/${assignment.id}`)}
						class="ml-4 rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
					>
						Bearbeiten
					</a>
				</div>
			{/each}
		</div>
	{/if}
</div>
