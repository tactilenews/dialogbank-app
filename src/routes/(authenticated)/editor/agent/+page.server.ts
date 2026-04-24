import { ElevenLabsError } from "@elevenlabs/elevenlabs-js";
import { error, fail } from "@sveltejs/kit";
import {
	type AgentReaderResponse,
	createElevenLabsAgentReader,
	createElevenLabsAgentWriter,
	getElevenLabsEditorAgent,
	type Question,
	resolveElevenLabsAgentTarget,
	updateElevenLabsAgentQuestions,
} from "$lib/server/elevenlabs/agent";
import { withAuthenticatedActions, withAuthenticatedLoad } from "$lib/server/require-user";
import type { Actions, PageServerLoad } from "./$types";

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

export const actions = withAuthenticatedActions<Parameters<Actions["default"]>[0], Actions>({
	default: async (event) => {
		const agentTarget = resolveElevenLabsAgentTarget(process.env);
		const reader = createElevenLabsAgentReader(process.env);
		const writer = createElevenLabsAgentWriter(process.env);

		let existingAgent: AgentReaderResponse;
		try {
			existingAgent = await reader.get(agentTarget.agentId, { branchId: agentTarget.branchId });
		} catch (e: unknown) {
			if (!(e instanceof ElevenLabsError)) {
				throw e;
			}
			return fail(e.statusCode || 500, {
				success: false,
				message: `Agent konnte nicht geladen werden: ${e.message || "Unbekannter Fehler"}`,
			});
		}

		const formData = await event.request.formData();
		const rawTexts = formData.getAll("questions");
		const rawClassifications = formData.getAll("question_classifications");
		const questions: Question[] = rawTexts
			.map((v, i) => {
				const text = typeof v === "string" ? v.trim() : "";
				let classifications: string[] = [];
				const raw = rawClassifications[i];
				if (typeof raw === "string") {
					try {
						const parsed = JSON.parse(raw);
						if (Array.isArray(parsed)) {
							classifications = parsed.filter(
								(c): c is string => typeof c === "string" && c.trim() !== "",
							);
						}
					} catch {
						// ignore malformed JSON
					}
				}
				return { text, classifications };
			})
			.filter(({ text }) => Boolean(text));

		try {
			await updateElevenLabsAgentQuestions(agentTarget, questions, existingAgent, writer);
		} catch (e: unknown) {
			if (!(e instanceof ElevenLabsError)) {
				throw e;
			}
			return fail(e.statusCode || 500, {
				success: false,
				message: `Fragen konnten nicht gespeichert werden: ${e.message || "Unbekannter Fehler"}`,
			});
		}

		return { success: true, message: "Fragen wurden gespeichert." };
	},
});
