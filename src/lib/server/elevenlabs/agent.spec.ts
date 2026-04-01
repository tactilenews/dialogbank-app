import type { GetAgentResponseModel } from "@elevenlabs/elevenlabs-js/api";
import { describe, expect, it, vi } from "vitest";
import {
	type ElevenLabsEnv,
	getElevenLabsEditorAgent,
	resolveElevenLabsAgentTarget,
} from "./agent";

describe("resolveElevenLabsAgentTarget", () => {
	it("returns the configured agent and branch ids", () => {
		const environment: ElevenLabsEnv = {
			ELEVENLABS_AGENT_ID: "agent_main_123",
			ELEVENLABS_AGENT_BRANCH_ID: "agtbrch_main_123",
		};

		expect(resolveElevenLabsAgentTarget(environment)).toEqual({
			agentId: "agent_main_123",
			branchId: "agtbrch_main_123",
		});
	});

	it("throws when the branch id is missing", () => {
		const environment: ElevenLabsEnv = {
			ELEVENLABS_AGENT_ID: "agent_main_123",
		};

		try {
			resolveElevenLabsAgentTarget(environment);
		} catch (thrown) {
			expect(thrown).toMatchObject({
				status: 500,
				body: {
					message: "ELEVENLABS_AGENT_BRANCH_ID is not configured on the server.",
				},
			});
			return;
		}

		throw new Error("Expected resolveElevenLabsAgentTarget to throw");
	});
});

describe("getElevenLabsEditorAgent", () => {
	it("reads the configured branch and maps the editor payload", async () => {
		const get = vi
			.fn<(agentId: string, request?: { branchId?: string }) => Promise<GetAgentResponseModel>>()
			.mockResolvedValue({
				name: "Dialogbank Test Agent",
				conversationConfig: {
					agent: {
						prompt: {
							prompt: "Ask one question at a time.",
						},
					},
				},
			} as GetAgentResponseModel);

		await expect(
			getElevenLabsEditorAgent(
				{
					agentId: "agent_main_123",
					branchId: "agtbrch_e2e_123",
				},
				{ get },
			),
		).resolves.toEqual({
			id: "agent_main_123",
			branchId: "agtbrch_e2e_123",
			name: "Dialogbank Test Agent",
			systemPrompt: "Ask one question at a time.",
		});

		expect(get).toHaveBeenCalledWith("agent_main_123", {
			branchId: "agtbrch_e2e_123",
		});
	});
});
