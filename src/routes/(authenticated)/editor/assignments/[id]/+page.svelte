<script lang="ts">
import type { LiteralJsonSchemaProperty } from "@elevenlabs/elevenlabs-js/api";
import { untrack } from "svelte";
import { enhance } from "$app/forms";
import { resolve } from "$app/paths";
import type { ActionData, PageData } from "./$types";

function sortedDataCollectionEntries(
	dc: Record<string, LiteralJsonSchemaProperty>,
): [string, LiteralJsonSchemaProperty][] {
	return Object.entries(dc).sort(([a], [b]) => a.localeCompare(b));
}

let { data, form }: { data: PageData; form: ActionData } = $props();

let nextId = $state(0);
let submitting = $state(false);

type QuestionItem = {
	id: number;
	text: string;
	selectedClassificationIds: number[];
	newLabels: string[];
	newLabelInput: string;
};

let questionItems = $state<QuestionItem[]>(
	untrack(() =>
		data.questions.map((q: (typeof data.questions)[number]) => ({
			id: nextId++,
			text: q.text,
			selectedClassificationIds: q.classifications.map((c: { id: number }) => c.id),
			newLabels: [],
			newLabelInput: "",
		})),
	),
);

function addQuestion() {
	questionItems.push({
		id: nextId++,
		text: "",
		selectedClassificationIds: [],
		newLabels: [],
		newLabelInput: "",
	});
}

function removeQuestion(id: number) {
	const idx = questionItems.findIndex((q) => q.id === id);
	if (idx !== -1) questionItems.splice(idx, 1);
}

function toggleClassification(questionId: number, classificationId: number) {
	const q = questionItems.find((q) => q.id === questionId);
	if (!q) return;
	const idx = q.selectedClassificationIds.indexOf(classificationId);
	if (idx === -1) {
		q.selectedClassificationIds.push(classificationId);
	} else {
		q.selectedClassificationIds.splice(idx, 1);
	}
}

function addNewLabel(questionId: number) {
	const q = questionItems.find((q) => q.id === questionId);
	if (!q) return;
	const label = q.newLabelInput.trim();
	if (!label || q.newLabels.includes(label)) return;
	q.newLabels.push(label);
	q.newLabelInput = "";
}

function removeNewLabel(questionId: number, label: string) {
	const q = questionItems.find((q) => q.id === questionId);
	if (!q) return;
	const idx = q.newLabels.indexOf(label);
	if (idx !== -1) q.newLabels.splice(idx, 1);
}

function makeEnhancer() {
	return () => {
		submitting = true;
		return ({ update }: { update: (opts: { reset: boolean }) => Promise<void> }) => {
			update({ reset: false }).then(() => {
				submitting = false;
			});
		};
	};
}
</script>

<svelte:head>
	<title>{data.assignment.name} | Einsätze | Dialogbank</title>
</svelte:head>

<div class="max-w-3xl">
	<div class="mb-6 flex items-center gap-3">
		<a href={resolve("/editor/assignments")} class="text-sm text-gray-500 hover:text-gray-900">← Einsätze</a>
		<h1 class="text-3xl font-bold">{data.assignment.name}</h1>
		{#if data.assignment.isActive}
			<span class="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
				AKTIV
			</span>
		{/if}
	</div>

	<div class="rounded-lg border bg-white p-6 shadow-md">
		<form
			id="assignment-form"
			method="POST"
			use:enhance={makeEnhancer()}
		>
			<fieldset disabled={submitting} class="min-w-0">
				<!-- Metadata -->
				<div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div class="sm:col-span-2">
						<label for="name" class="mb-1 block text-sm font-medium text-gray-700">Name *</label>
						<input
							id="name"
							type="text"
							name="name"
							value={data.assignment.name}
							required
							class="w-full rounded border border-gray-300 px-3 py-2 text-sm disabled:cursor-not-allowed"
						/>
					</div>
					<div>
						<label for="location" class="mb-1 block text-sm font-medium text-gray-700">Ort</label>
						<input
							id="location"
							type="text"
							name="location"
							value={data.assignment.location ?? ""}
							class="w-full rounded border border-gray-300 px-3 py-2 text-sm disabled:cursor-not-allowed"
						/>
					</div>
					<div>
						<label for="client" class="mb-1 block text-sm font-medium text-gray-700">
							Auftraggeber
						</label>
						<input
							id="client"
							type="text"
							name="client"
							value={data.assignment.client ?? ""}
							class="w-full rounded border border-gray-300 px-3 py-2 text-sm disabled:cursor-not-allowed"
						/>
					</div>
					<div class="sm:col-span-2">
						<label for="promptSupplement" class="mb-1 block text-sm font-medium text-gray-700">
							Promptergänzung
						</label>
						<textarea
							id="promptSupplement"
							name="promptSupplement"
							rows={3}
							class="w-full rounded border border-gray-300 px-3 py-2 text-sm disabled:cursor-not-allowed"
						>{data.assignment.promptSupplement ?? ""}</textarea>
					</div>
				</div>

				<!-- Questions -->
				<div class="border-t border-gray-100 pt-6">
					<h3 class="mb-4 text-sm font-medium tracking-wider text-gray-500 uppercase">Fragen</h3>

					<div class="flex flex-col gap-4">
						{#each questionItems as item, i (item.id)}
							<div
								class="rounded border border-gray-200 p-4 transition-opacity {submitting
									? 'opacity-50'
									: ''}"
							>
								<div class="flex items-center gap-2">
									<input
										type="text"
										name="questions"
										value={item.text}
										placeholder="Frage {i + 1}"
										class="flex-1 rounded border border-gray-300 px-3 py-2 text-sm disabled:cursor-not-allowed"
									/>
									<button
										type="button"
										aria-label="Frage {i + 1} entfernen"
										onclick={() => removeQuestion(item.id)}
										class="rounded border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed"
									>
										Entfernen
									</button>
								</div>

								<!-- Hidden serialization inputs -->
								<input
									type="hidden"
									name="question_classification_ids"
									value={JSON.stringify(item.selectedClassificationIds)}
								/>
								<input
									type="hidden"
									name="question_new_labels"
									value={JSON.stringify(item.newLabels)}
								/>

								<!-- Classification section -->
								<div class="mt-3 border-t border-gray-100 pt-3">
									<p class="mb-2 text-xs font-medium tracking-wider text-gray-400 uppercase">
										Klassifizierungen
									</p>

									{#if data.allClassifications.length > 0}
										<div class="flex flex-wrap gap-2">
											{#each data.allClassifications as cls (cls.id)}
												<label class="flex cursor-pointer items-center gap-1.5 rounded border px-2 py-1 text-sm {item.selectedClassificationIds.includes(cls.id) ? 'border-gray-700 bg-gray-700 text-white' : 'border-gray-300 text-gray-600 hover:border-gray-500'}">
													<input
														type="checkbox"
														class="sr-only"
														checked={item.selectedClassificationIds.includes(cls.id)}
														onchange={() => toggleClassification(item.id, cls.id)}
													/>
													{cls.label}
												</label>
											{/each}
										</div>
									{/if}

									<!-- New labels already added -->
									{#if item.newLabels.length > 0}
										<div class="mt-2 flex flex-wrap gap-2">
											{#each item.newLabels as label (label)}
												<span class="flex items-center gap-1 rounded border border-blue-300 bg-blue-50 px-2 py-1 text-sm text-blue-700">
													{label} <span class="font-mono text-xs text-blue-400">(neu)</span>
													<button
														type="button"
														aria-label="{label} entfernen"
														onclick={() => removeNewLabel(item.id, label)}
														class="ml-1 text-blue-400 hover:text-blue-700"
													>✕</button>
												</span>
											{/each}
										</div>
									{/if}

									<!-- Input to create a new classification -->
									<div class="mt-2 flex items-center gap-2">
										<input
											type="text"
											bind:value={item.newLabelInput}
											placeholder="Neue Klassifizierung…"
											onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addNewLabel(item.id); } }}
											class="rounded border border-gray-300 px-3 py-1.5 text-sm disabled:cursor-not-allowed"
										/>
										<button
											type="button"
											onclick={() => addNewLabel(item.id)}
											class="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed"
										>
											Hinzufügen
										</button>
									</div>
								</div>
							</div>
						{/each}
					</div>

					<button
						type="button"
						onclick={addQuestion}
						class="mt-4 rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed"
					>
						+ Frage hinzufügen
					</button>
				</div>

				<!-- Actions -->
				<div class="mt-6 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-6">
					<button
						type="submit"
						formaction="?/save"
						class="flex items-center gap-2 rounded border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
					>
						{#if submitting}
							<svg class="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
							</svg>
						{/if}
						Speichern
					</button>
					<button
						type="submit"
						formaction="?/activate"
						class="flex items-center gap-2 rounded bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
					>
						{#if submitting}
							<svg class="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
							</svg>
						{/if}
						Aktivieren & Agent konfigurieren
					</button>

					{#if form?.message}
						<p class="text-sm {form.success ? 'text-green-600' : 'text-red-600'}">
							{form.message}
						</p>
					{/if}
				</div>
			</fieldset>
		</form>
	</div>

	<div class="mt-6 rounded-lg border bg-white p-6 shadow-md">
		<h2 class="mb-4 text-lg font-semibold">Aktueller Agent</h2>

		{#if data.agent}
			<div>
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
		{:else}
			<p class="text-sm text-gray-400">
				Agent-Konfiguration konnte nicht geladen werden. Stellen Sie sicher, dass
				ELEVENLABS_AGENT_ID und ELEVENLABS_API_KEY konfiguriert sind.
			</p>
		{/if}
	</div>
</div>
