<script lang="ts">
type Props = {
	value?: string | null;
	name?: string;
	onpick?: (emoji: string | null) => void;
};

let { value = $bindable(null), name, onpick }: Props = $props();

let open = $state(false);
let container: HTMLElement;

const emojis = [
	"❤️",
	"💔",
	"😊",
	"😢",
	"😡",
	"😤",
	"😮",
	"🤔",
	"💡",
	"⚠️",
	"👥",
	"🤝",
	"✊",
	"💪",
	"🗳️",
	"🏛️",
	"⚖️",
	"🌍",
	"🌐",
	"📣",
	"🏙️",
	"🏘️",
	"🏗️",
	"🚗",
	"🚌",
	"✈️",
	"🏠",
	"🏥",
	"🏫",
	"🏟️",
	"🌳",
	"🌻",
	"🌊",
	"☀️",
	"🌙",
	"🌧️",
	"🌈",
	"🌱",
	"♻️",
	"🌿",
	"📰",
	"📊",
	"🎯",
	"🔔",
	"🎉",
	"⭐",
	"🏆",
	"🔑",
	"💰",
	"📝",
];

function pick(emoji: string) {
	value = emoji;
	open = false;
	onpick?.(emoji);
}

function clear() {
	value = null;
	open = false;
	onpick?.(null);
}

function handleWindowClick(e: MouseEvent) {
	if (!container?.contains(e.target as Node)) open = false;
}

function handleKeydown(e: KeyboardEvent) {
	if (e.key === "Escape") open = false;
}
</script>

<svelte:window onclick={handleWindowClick} onkeydown={handleKeydown} />

<div bind:this={container} class="relative inline-block">
	<button
		type="button"
		onclick={() => (open = !open)}
		aria-label="Emoji auswählen"
		aria-expanded={open}
		class="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 hover:bg-slate-50 {value ? 'text-xl' : 'text-slate-400'}"
	>
		{#if value}
			{value}
		{:else}
			<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
				<path fill-rule="evenodd" d="M10 3a7 7 0 100 14A7 7 0 0010 3zM6.5 9a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm7 0a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm-7.657 3.414a.75.75 0 011.06.03 3.5 3.5 0 004.193 0 .75.75 0 111.03 1.09 5 5 0 01-6.253 0 .75.75 0 01.03-1.06l-.06.06z" clip-rule="evenodd" />
			</svg>
		{/if}
	</button>

	{#if open}
		<div class="absolute left-0 top-full z-50 mt-1 w-max rounded-xl border border-slate-200 bg-white p-2 shadow-lg" role="dialog" aria-label="Emoji auswählen">
			<div class="grid grid-cols-10 gap-0.5">
				{#each emojis as emoji}
					<button
						type="button"
						onclick={() => pick(emoji)}
						title={emoji}
						class="flex h-8 w-8 items-center justify-center rounded text-xl hover:bg-slate-100 {value === emoji ? 'bg-slate-100 ring-1 ring-slate-400' : ''}"
					>
						{emoji}
					</button>
				{/each}
			</div>
			{#if value}
				<button
					type="button"
					onclick={clear}
					class="mt-1.5 w-full rounded border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
				>
					Entfernen
				</button>
			{/if}
		</div>
	{/if}

	{#if name}
		<input type="hidden" {name} value={value ?? ""} />
	{/if}
</div>
