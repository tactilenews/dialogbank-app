<script lang="ts">
import type { Snippet } from "svelte";
import { fade } from "svelte/transition";
import { navigating, page } from "$app/state";
import { hasPendingNavigation } from "$lib/navigation-state";
import "./layout.css";
import favicon from "$lib/assets/favicon.svg";

let { children }: { children: Snippet } = $props();

const loadingIndicatorDelayMs = 180;

let showLoadingIndicator = $state(false);

const routeKey = $derived(`${page.url.pathname}${page.url.search}`);
const isNavigationPending = $derived(hasPendingNavigation(navigating));

$effect(() => {
	if (!isNavigationPending) {
		showLoadingIndicator = false;
		return;
	}

	const timeout = window.setTimeout(() => {
		showLoadingIndicator = true;
	}, loadingIndicatorDelayMs);

	return () => {
		window.clearTimeout(timeout);
		showLoadingIndicator = false;
	};
});
</script>

<svelte:head>
	<title>Dialogbank</title>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="app-shell">
	<div
		class="app-loading-indicator"
		class:app-loading-indicator-visible={showLoadingIndicator}
		aria-hidden={showLoadingIndicator ? "false" : "true"}
	>
		<div class="app-loading-indicator-bar"></div>
		<div class="app-loading-indicator-label">Loading server data…</div>
	</div>

	<div class="app-page-shell" aria-busy={showLoadingIndicator ? "true" : "false"}>
		{#key routeKey}
			<div
				class="app-page-transition"
				in:fade={{ duration: 200 }}
				out:fade={{ duration: 140 }}
			>
				{@render children()}
			</div>
		{/key}
	</div>
</div>
