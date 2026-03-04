import { env } from '$env/dynamic/private';
import { ElevenLabsClient, ElevenLabsError } from '@elevenlabs/elevenlabs-js';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const apiKey = env.ELEVENLABS_API_KEY;
	const agentId = env.ELEVENLABS_AGENT_ID;

	if (!apiKey) {
		throw error(500, 'ELEVENLABS_API_KEY is not configured on the server.');
	}

	if (!agentId) {
		throw error(500, 'ELEVENLABS_AGENT_ID is not configured on the server.');
	}

	const client = new ElevenLabsClient({
		apiKey
	});

	try {
		const agent = await client.conversationalAi.agents.get(agentId);

		return {
			agent: {
				id: agentId,
				name: agent.name ?? 'Unnamed Agent',
				systemPrompt:
					agent.conversationConfig?.agent?.prompt?.prompt ?? 'No system prompt configured.'
			}
		};
	} catch (e: unknown) {
		if (!(e instanceof ElevenLabsError)) {
			throw e;
		}
		if (e.statusCode === 401) {
			throw error(401, 'Unauthorized: Invalid ElevenLabs API Key.');
		}
		if (e.statusCode === 404) {
			throw error(404, `Agent with ID "${agentId}" not found.`);
		}
		throw error(e.statusCode || 500, `Failed to fetch agent: ${e.message || 'Unknown error'}`);
	}
};
