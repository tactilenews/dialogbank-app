import { describe, expect, it } from "vitest";
import { hasPendingNavigation } from "./navigation-state";

describe("hasPendingNavigation", () => {
	it("returns false when the SvelteKit navigation wrapper has no destination", () => {
		expect(hasPendingNavigation({ to: null })).toBe(false);
	});

	it("returns true when the SvelteKit navigation wrapper points to a destination", () => {
		expect(
			hasPendingNavigation({
				to: {
					url: new URL("https://example.com/editor/agent"),
				},
			}),
		).toBe(true);
	});
});
