<script lang="ts">
import type { Snippet } from "svelte";
import { enhance } from "$app/forms";
import { resolve } from "$app/paths";
import "./layout.css";
import favicon from "$lib/assets/favicon.svg";
import type { LayoutData } from "./$types";

let { children, data }: { children: Snippet; data: LayoutData } = $props();

const navigationLinks = $derived.by(() => {
	const links = [
		{ href: resolve("/"), label: "Home" },
		{ href: resolve("/dialogbank"), label: "DialogBank" },
	];

	if (data.user) {
		links.push(
			{ href: resolve("/editor/agent"), label: "Editor Agent" },
			{ href: resolve("/editor/dashboard"), label: "Editor Dashboard" },
		);
	}

	return links;
});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="min-h-screen bg-white text-gray-950">
	<header class="border-b border-gray-200 bg-white/95 backdrop-blur">
		<div class="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-3 sm:px-6 lg:px-8">
			<nav aria-label="Top level">
				<ul class="flex flex-wrap items-center gap-2 sm:gap-3">
					{#each navigationLinks as link}
						<li>
							<a
								href={link.href}
								class="inline-flex rounded-md px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 hover:text-gray-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
							>
								{link.label}
							</a>
						</li>
					{/each}
				</ul>
			</nav>

			<div class="shrink-0">
				{#if data.user}
					<form method="post" action={resolve("/auth/sign-out")} use:enhance>
						<button
							type="submit"
							class="inline-flex rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
						>
							Sign-out
						</button>
					</form>
				{:else}
					<a
						href={resolve("/auth/sign-in")}
						class="inline-flex rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
					>
						Sign-in
					</a>
				{/if}
			</div>
		</div>
	</header>

	<main>{@render children()}</main>
</div>
