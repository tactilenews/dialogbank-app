<script lang="ts">
import { enhance } from "$app/forms";
import type { ActionData } from "./$types";

let { form }: { form: ActionData } = $props();
</script>

<div class="flex min-h-screen items-center justify-center bg-gray-50 p-4">
	<div class="w-full max-w-md space-y-8 rounded-xl bg-white p-8 shadow-lg">
		<div class="text-center">
			<h1 class="text-3xl font-bold text-gray-900">Sign-in</h1>
			<p class="mt-2 text-sm text-gray-600">Enter your credentials to access your account</p>
		</div>

		<form method="post" action="?/signInEmail" use:enhance class="mt-8 space-y-6">
			<div class="space-y-4 rounded-md shadow-xs">
				<div class="flex flex-col gap-1.5">
					<label for="email" class="text-sm font-medium text-gray-700"> Email address </label>
					<input
						id="email"
						type="email"
						name="email"
						required
						class="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
						placeholder="you@example.com"
					/>
				</div>
				<div class="flex flex-col gap-1.5">
					<label for="password" class="text-sm font-medium text-gray-700"> Password </label>
					<input
						id="password"
						type="password"
						name="password"
						required
						class="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
						placeholder="••••••••"
					/>
				</div>
			</div>

			{#if form?.message}
				<div class="rounded-md bg-red-50 p-3 text-sm text-red-600">
					{form.message}
				</div>
			{/if}

			<div>
				<button
					type="submit"
					class="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
				>
					Sign-in
				</button>
			</div>
		</form>
	</div>
</div>
