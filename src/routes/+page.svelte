<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<div class="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4 text-center">
	<h1 class="text-4xl font-extrabold text-gray-900">DialogBank</h1>
	<p class="mt-4 text-lg text-gray-600">This is a public page for DialogBank.</p>
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
