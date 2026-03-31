import { ElevenLabsError } from "@elevenlabs/elevenlabs-js";
import { error } from "@sveltejs/kit";
import {
	createElevenLabsAgentReader,
	getElevenLabsEditorAgent,
	resolveElevenLabsAgentTarget,
} from "$lib/server/elevenlabs/agent";
import { withAuthenticatedLoad } from "$lib/server/require-user";
import type { PageServerLoad } from "./$types";

export const load = withAuthenticatedLoad<
	Parameters<PageServerLoad>[0],
	ReturnType<PageServerLoad>
>(async () => {
	const agentTarget = resolveElevenLabsAgentTarget(process.env);
	const reader = createElevenLabsAgentReader(process.env);
	try {
		return {
			agent: await getElevenLabsEditorAgent(agentTarget, reader),
		};
	} catch (e: unknown) {
		if (!(e instanceof ElevenLabsError)) {
			throw e;
		}
		if (e.statusCode === 401) {
			throw error(401, "Unauthorized: Invalid ElevenLabs API Key.");
		}
		if (e.statusCode === 404) {
			throw error(404, `Agent with ID "${agentTarget.agentId}" not found.`);
		}
		throw error(e.statusCode || 500, `Failed to fetch agent: ${e.message || "Unknown error"}`);
	}
});
