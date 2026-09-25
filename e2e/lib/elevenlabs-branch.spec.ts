import { describe, expect, it, vi } from "vitest";
import {
	createEphemeralElevenLabsBranch,
	deleteElevenLabsBranch,
	resolveElevenLabsBranchContext,
} from "./elevenlabs-branch";

describe("resolveElevenLabsBranchContext", () => {
	it("returns the required ElevenLabs branch context", () => {
		expect(
			resolveElevenLabsBranchContext({
				ELEVENLABS_API_KEY: "api-key",
				ELEVENLABS_AGENT_ID: "agent_123",
				ELEVENLABS_AGENT_PARENT_BRANCH_ID: "agtbrch_main_123",
			}),
		).toEqual({
			apiKey: "api-key",
			agentId: "agent_123",
			parentBranchId: "agtbrch_main_123",
		});
	});
});

describe("ElevenLabs branch lifecycle helpers", () => {
	it("creates a named branch from the latest committed parent version", async () => {
		const get = vi.fn().mockResolvedValue({
			mostRecentVersions: [{ id: "version_7", seqNoInBranch: 7, timeCommittedSecs: 100 }],
		});
		const create = vi.fn().mockResolvedValue({
			createdBranchId: "agtbrch_e2e_123",
		});

		await expect(
			createEphemeralElevenLabsBranch(
				{
					conversationalAi: {
						agents: {
							branches: {
								get,
								create,
								update: vi.fn(),
							},
						},
					},
				},
				{
					apiKey: "api-key",
					agentId: "agent_123",
					parentBranchId: "agtbrch_main_123",
				},
				new Date("2026-03-31T10:00:00.000Z"),
			),
		).resolves.toEqual({
			branchId: "agtbrch_e2e_123",
			name: expect.stringMatching(/^dialogbank-e2e-2026-03-31T10-00-00-000Z-/),
		});

		expect(get).toHaveBeenCalledWith("agent_123", "agtbrch_main_123");
		expect(create).toHaveBeenCalledWith(
			"agent_123",
			expect.objectContaining({
				parentVersionId: "version_7",
				description: expect.stringContaining("2026-03-31T10:00:00.000Z"),
			}),
		);
	});

	it("archives the provided branch id", async () => {
		const update = vi.fn().mockResolvedValue(undefined);

		await expect(
			deleteElevenLabsBranch(
				{
					conversationalAi: {
						agents: {
							branches: {
								get: vi.fn(),
								create: vi.fn(),
								update,
							},
						},
					},
				},
				{
					agentId: "agent_123",
				},
				"agtbrch_e2e_123",
			),
		).resolves.toBeUndefined();

		expect(update).toHaveBeenCalledWith("agent_123", "agtbrch_e2e_123", {
			isArchived: true,
		});
	});
});
