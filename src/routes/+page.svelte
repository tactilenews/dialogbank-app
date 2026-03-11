<script lang="ts">
import { fade } from "svelte/transition";
import { enhance } from "$app/forms";
import { resolve } from "$app/paths";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();

let currentAnswerIndex = $state(0);

$effect(() => {
	if (data.answers.length > 0) {
		const interval = setInterval(() => {
			currentAnswerIndex = (currentAnswerIndex + 1) % data.answers.length;
		}, 5000);

		return () => clearInterval(interval);
	}
});
</script>

<div class="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4 text-center">
	<h1 class="text-4xl font-extrabold text-gray-900">DialogBank</h1>
	<p class="mt-4 text-lg text-gray-600">This is a public page for DialogBank.</p>

	{#if data.answers.length > 0}
		<div class="mt-8 w-full max-w-2xl">
			<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-md">
				<p class="text-sm font-medium tracking-wider text-gray-500 uppercase">Featured Answer</p>
				{#key currentAnswerIndex}
					<div in:fade={{ duration: 500 }} out:fade={{ duration: 500 }}>
						<p class="mt-4 text-xl text-gray-800">
							{data.answers[currentAnswerIndex].value}
						</p>
					</div>
				{/key}
				<p class="mt-4 text-xs text-gray-400">
					{currentAnswerIndex + 1} / {data.answers.length}
				</p>
			</div>
		</div>
	{/if}

	<div class="mt-8 flex items-center gap-4">
		{#if data.user}
			<form method="post" action="/auth/sign-out" use:enhance>
				<button
					class="rounded-lg bg-gray-200 px-6 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-300 focus:outline-none"
				>
					Sign out
				</button>
			</form>
		{:else}
			<a
				href={resolve('/auth/sign-in')}
				class="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none"
			>
				Sign in
			</a>
		{/if}
		<a
			href={resolve('/dialogbank')}
			class="rounded-lg border border-gray-300 bg-white px-6 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 focus:outline-none"
		>
			Go to Agent Explorer
		</a>
	</div>
</div>
