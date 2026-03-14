<script lang="ts">
import { fly } from "svelte/transition";
import { invalidateAll } from "$app/navigation";
import logo from "$lib/assets/legacy-logo.svg";
import type { LegacyClassification } from "./+page.server";
import type { PageData } from "./$types";

const classificationValues = ["proGelsenkirchen", "conGelsenkirchen", "ideaGelsenkirchen"] as const;

const classificationStats = [
	{
		key: "proGelsenkirchen",
		singular: "gute Sache über Gelsenkirchen",
		plural: "gute Dinge über Gelsenkirchen",
		emoji: "❤️",
	},
	{
		key: "conGelsenkirchen",
		singular: "Problem in Gelsenkirchen",
		plural: "Probleme in Gelsenkirchen",
		emoji: "😤",
	},
	{
		key: "ideaGelsenkirchen",
		singular: "Idee für Gelsenkirchen",
		plural: "Ideen für Gelsenkirchen",
		emoji: "💡",
	},
] as const;

let { data }: { data: PageData } = $props();

type Quote = PageData["quotes"][number];

let currentIndex = $state(0);
let visibleClassification = $state<LegacyClassification | null>(null);
let shuffledQueue = $state<number[]>([]);

const newQuoteThreshold = 15;
const intervalMs = 4500;

const quotes = $derived(data.quotes ?? []);

const isLegacyClassification = (value: string | null | undefined): value is LegacyClassification =>
	!!value && classificationValues.includes(value as LegacyClassification);

const createWeightedQueue = (quotesArray: Quote[]) => {
	if (quotesArray.length === 0) return [];

	const queue: number[] = [];
	const threshold = Math.min(newQuoteThreshold, quotesArray.length);

	for (let index = 0; index < threshold; index += 1) {
		queue.push(index, index, index, index);
	}

	for (let index = 0; index < quotesArray.length; index += 1) {
		queue.push(index);
	}

	for (let index = queue.length - 1; index > 0; index -= 1) {
		const swapIndex = Math.floor(Math.random() * (index + 1));
		[queue[index], queue[swapIndex]] = [queue[swapIndex], queue[index]];
	}

	return queue;
};

const setVisibleForQuote = (index: number) => {
	const classification = quotes[index]?.classification;
	visibleClassification = isLegacyClassification(classification) ? classification : null;
};

const getNextQuoteIndex = () => {
	if (quotes.length === 0) return 0;

	if (shuffledQueue.length === 0) {
		shuffledQueue = createWeightedQueue(quotes);
	}

	const nextIndex = shuffledQueue.shift();
	return typeof nextIndex === "number" ? nextIndex : Math.floor(Math.random() * quotes.length);
};

const updateCurrent = () => {
	if (quotes.length === 0) return;
	currentIndex = getNextQuoteIndex();
	setVisibleForQuote(currentIndex);
};

const formatName = (quote: Quote) => {
	const nameParts = [quote.firstName, quote.lastName].filter(
		(part): part is string => !!part && part.trim().length > 0,
	);
	const name = nameParts.join(" ");

	if (!name && quote.age == null) return "";
	if (!name && quote.age != null) return `${quote.age} Jahre`;
	if (quote.age != null) return `${name}, ${quote.age} Jahre`;
	return name;
};

const emojiForClassification = (classification: string | null | undefined) => {
	if (classification === "ideaGelsenkirchen") return "💡";
	if (classification === "proGelsenkirchen") return "❤️";
	if (classification === "conGelsenkirchen") return "😤";
	return "";
};

$effect(() => {
	currentIndex = 0;
	shuffledQueue = createWeightedQueue(quotes);

	if (quotes.length > 0) {
		setVisibleForQuote(0);
	} else {
		visibleClassification = null;
	}
});

$effect(() => {
	if (quotes.length === 0) return;

	const interval = setInterval(updateCurrent, intervalMs);
	return () => clearInterval(interval);
});

$effect(() => {
	const refreshIntervalMs = 15000;
	const interval = setInterval(async () => {
		await invalidateAll();
	}, refreshIntervalMs);
	return () => clearInterval(interval);
});
</script>

<div class="legacy-root">
	<div class="legacy-shell">
		<div class="legacy-header">
			<img src={logo} alt="Logo" class="legacy-logo" />
			<h1 class="legacy-title">LIVE AUS DER FEEDBACKKABINE ÜBER GELSENKIRCHEN</h1>
		</div>

		<div class="legacy-body">
			<div class="legacy-grid">
				<div class="legacy-stats">
					<div class="legacy-stat" data-testid="stat-guests">
						<div class="legacy-stat-value">{data.guests}</div>
						<div class="legacy-stat-label">
							{data.guests === 1 ? "Gast" : "Gäste"}
						</div>
					</div>
					<div class="legacy-stat" data-testid="stat-answers">
						<div class="legacy-stat-value">{data.answerCount}</div>
						<div class="legacy-stat-label">
							{data.answerCount === 1 ? "Antwort" : "Antworten"}
						</div>
					</div>

					{#each classificationStats as stat}
						<div
							class="legacy-stat"
							class:legacy-stat-highlight={visibleClassification === stat.key}
							data-testid={`stat-${stat.key}`}
							data-highlighted={visibleClassification === stat.key ? "true" : "false"}
						>
							<div class="legacy-stat-value">
								{stat.emoji}
								{data.classificationCounts[stat.key] ?? 0}
							</div>
							<div class="legacy-stat-label">
								{data.classificationCounts[stat.key] === 1 ? stat.singular : stat.plural}
							</div>
						</div>
					{/each}
				</div>

				<div class="legacy-quotes">
					{#if quotes.length > 0}
						{#key currentIndex}
							{@const currentQuote = quotes[currentIndex]}
							<div class="legacy-quote-wrapper">
								<div
									in:fly={{ y: 600, duration: 1700 }}
									out:fly={{ y: -600, duration: 1700 }}
									class="legacy-quote-card"
									data-testid="current-quote"
								>
									<div class="legacy-quote-text">
										{emojiForClassification(currentQuote?.classification)}»{currentQuote?.text?.trim() ?? ""}«
									</div>
									{#if currentQuote && formatName(currentQuote)}
										<div class="legacy-quote-meta">
											{formatName(currentQuote)}
										</div>
									{/if}
								</div>
							</div>
						{/key}
					{:else}
						<div class="legacy-empty">Noch keine veröffentlichten Antworten.</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	.legacy-root {
		--brand-honig: #b37500;
		--brand-wdr-blau: #00345e;
		--brand-blau-hell: rgb(0, 78, 134);
		--brand-sand: #dfd8cb;
		--brand-sand-hell: rgb(242, 238, 231);
		--brand-mint-hell: #009bae;
		--brand-font: #00345e;
		--brand-font-secondary: rgb(0, 78, 134);
		--brand-font-headline: #b37500;
		--font-sans: "WDR Sans", "Helvetica Neue", Arial, sans-serif;
		--font-slab: "WDR Slab", Georgia, serif;
		min-height: 100vh;
		background: linear-gradient(
			45deg,
			var(--brand-sand) 0%,
			var(--brand-sand-hell) 25%,
			var(--brand-sand-hell) 100%
		);
		color: var(--brand-font);
		font-family: var(--font-sans);
	}

	.legacy-shell {
		width: 90%;
		margin: 0 auto;
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		padding: 2rem 1.5rem;
		box-sizing: border-box;
	}

	.legacy-header {
		width: 100%;
		height: 20vh;
		min-height: 0;
		max-height: 20vh;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 0.75rem;
		margin-bottom: 1rem;
	}

	.legacy-logo {
		width: 6rem;
		margin-top: 2rem;
	}

	.legacy-title {
		font-family: var(--font-slab);
		color: var(--brand-font-headline);
		font-size: clamp(1.25rem, 2vw, 2.25rem);
		font-weight: 500;
		letter-spacing: 0.02em;
		line-height: 1.2;
		margin: 0;
	}

	.legacy-body {
		width: 100%;
		height: 80vh;
		max-height: 80vh;
		min-height: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.legacy-grid {
		width: 100%;
		height: 100%;
		display: grid;
		grid-template-columns: 1fr 2fr;
		gap: 1rem;
	}

	.legacy-stats {
		display: flex;
		flex-direction: column;
		justify-content: space-evenly;
		gap: 0.75rem;
	}

	.legacy-stat {
		background: #ffffff;
		border: 3px solid var(--brand-wdr-blau);
		border-radius: 0.5rem;
		box-shadow: 0 8px 20px rgba(0, 52, 94, 0.12);
		padding: 0.75rem 1rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		transition: transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease;
	}

	.legacy-stat-highlight {
		border-color: var(--brand-mint-hell);
		transform: scale(1.05);
		box-shadow: 0 12px 30px rgba(0, 155, 174, 0.2);
	}

	.legacy-stat-value {
		font-size: clamp(1.5rem, 2vw, 2.5rem);
		font-weight: 500;
		color: var(--brand-font-headline);
	}

	.legacy-stat-label {
		font-size: clamp(0.85rem, 1.2vw, 1.2rem);
		font-weight: 400;
		color: var(--brand-font-secondary);
	}

	.legacy-quotes {
		position: relative;
		height: 100%;
		width: 100%;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.legacy-quote-wrapper {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0 1.5rem;
	}

	.legacy-quote-card {
		width: 100%;
		max-width: 42rem;
		background: #ffffff;
		border: 3px solid var(--brand-mint-hell);
		border-radius: 0.75rem;
		box-shadow: 0 10px 24px rgba(0, 52, 94, 0.15);
		padding: 1.5rem;
		text-align: left;
	}

	.legacy-quote-text {
		font-size: clamp(1.25rem, 2.4vw, 2.5rem);
		font-weight: 400;
		color: var(--brand-font);
		line-height: 1.4;
	}

	.legacy-quote-meta {
		margin-top: 0.75rem;
		font-size: clamp(0.85rem, 1.4vw, 1.25rem);
		color: var(--brand-font-secondary);
	}

	.legacy-empty {
		font-size: 1.25rem;
		color: var(--brand-font-secondary);
	}

	@media (max-width: 900px) {
		.legacy-grid {
			grid-template-columns: 1fr;
			height: auto;
		}

		.legacy-body {
			height: auto;
			max-height: none;
			padding-bottom: 2rem;
		}

		.legacy-header {
			height: auto;
			max-height: none;
		}

		.legacy-logo {
			margin-top: 1rem;
		}

		.legacy-quotes {
			min-height: 280px;
		}
	}
</style>
