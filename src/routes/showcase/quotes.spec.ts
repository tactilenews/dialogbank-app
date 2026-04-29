import { describe, expect, it } from "vitest";
import { getQuoteWeight, hasVisibleQuoteText, pickWeightedQuoteId } from "./quotes";

describe("showcase quote helpers", () => {
	it("filters out null, empty, and whitespace-only quote text", () => {
		expect(hasVisibleQuoteText(null)).toBe(false);
		expect(hasVisibleQuoteText("")).toBe(false);
		expect(hasVisibleQuoteText("   ")).toBe(false);
		expect(hasVisibleQuoteText(" sichtbar ")).toBe(true);
	});

	it("gives the latest ten answers the same weight before tapering off", () => {
		expect(getQuoteWeight(0)).toBe(10);
		expect(getQuoteWeight(9)).toBe(10);
		expect(getQuoteWeight(10)).toBeLessThan(10);
		expect(getQuoteWeight(10)).toBeGreaterThan(getQuoteWeight(20));
	});

	it("uses weighted selection for the initial quote instead of always picking the latest", () => {
		const quotes = [{ id: 30 }, { id: 29 }, { id: 28 }];

		expect(pickWeightedQuoteId(quotes, null, 0)).toBe(30);
		expect(pickWeightedQuoteId(quotes, null, 0.4)).toBe(29);
		expect(pickWeightedQuoteId(quotes, null, 0.9)).toBe(28);
	});

	it("excludes the active quote when rotating", () => {
		const quotes = [{ id: 30 }, { id: 29 }, { id: 28 }];

		expect(pickWeightedQuoteId(quotes, 30, 0)).toBe(29);
		expect(pickWeightedQuoteId(quotes, 29, 0.99)).toBe(28);
	});
});
