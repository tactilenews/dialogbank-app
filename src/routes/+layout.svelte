<script lang="ts">
import type { Snippet } from "svelte";
import "./layout.css";
import favicon from "$lib/assets/favicon.svg";

let { children }: { children: Snippet } = $props();
</script>

<svelte:head>
	<title>Dialogbank</title>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
