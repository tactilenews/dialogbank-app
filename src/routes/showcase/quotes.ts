type QuoteWithId = {
	id: number;
};

const recentQuotePlateauSize = 10;
const recentQuotePlateauWeight = 10;

export const hasVisibleQuoteText = (value: string | null | undefined): value is string =>
	typeof value === "string" && value.trim().length > 0;

export const getQuoteWeight = (index: number) => {
	if (index < recentQuotePlateauSize) {
		return recentQuotePlateauWeight;
	}

	return (
		recentQuotePlateauWeight / (1 + (index - recentQuotePlateauSize + 1) / recentQuotePlateauSize)
	);
};

export const pickWeightedQuoteId = <Quote extends QuoteWithId>(
	quotes: Quote[],
	activeQuoteId: number | null,
	randomValue = Math.random(),
) => {
	if (quotes.length === 0) return null;

	const candidates = quotes.filter((quote) => quote.id !== activeQuoteId);
	if (candidates.length === 0) {
		return quotes[0]?.id ?? null;
	}

	const totalWeight = candidates.reduce((sum, quote) => {
		const index = quotes.findIndex((candidate) => candidate.id === quote.id);
		return sum + getQuoteWeight(index);
	}, 0);
	let remainingWeight = randomValue * totalWeight;

	for (const quote of candidates) {
		const index = quotes.findIndex((candidate) => candidate.id === quote.id);
		remainingWeight -= getQuoteWeight(index);
		if (remainingWeight <= 0) {
			return quote.id;
		}
	}

	return candidates.at(-1)?.id ?? quotes[0]?.id ?? null;
};
