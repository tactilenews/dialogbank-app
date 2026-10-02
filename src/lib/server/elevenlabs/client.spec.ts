import { describe, expect, it, vi } from "vitest";

const constructedWith = vi.hoisted((): unknown[] => []);

vi.mock("@elevenlabs/elevenlabs-js", async (importOriginal) => ({
	...(await importOriginal<typeof import("@elevenlabs/elevenlabs-js")>()),
	ElevenLabsClient: class {
		constructor(options: unknown) {
			constructedWith.push(options);
		}
	},
}));

const {
	createElevenLabsAgentBranchReader,
	createElevenLabsAgentCatalogReader,
	createElevenLabsAgentReader,
	createElevenLabsAgentWriter,
} = await import("./agent");

describe("ElevenLabs clients of the app", () => {
	it("give up on a hanging request after eight seconds, without retrying", () => {
		const environment = { ELEVENLABS_API_KEY: "api-key" };

		createElevenLabsAgentReader(environment);
		createElevenLabsAgentWriter(environment);
		createElevenLabsAgentCatalogReader(environment);
		createElevenLabsAgentBranchReader(environment, { get: vi.fn() });

		expect(constructedWith).toHaveLength(4);
		for (const options of constructedWith) {
			expect(options).toEqual({ apiKey: "api-key", timeoutInSeconds: 8, maxRetries: 0 });
		}
	});
});
