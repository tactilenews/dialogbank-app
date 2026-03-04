import { env } from '$env/dynamic/private';
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

	const response = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
		headers: {
			'xi-api-key': apiKey
		}
	});

	if (!response.ok) {
		if (response.status === 401) {
			throw error(401, 'Unauthorized: Invalid ElevenLabs API Key.');
		}
		if (response.status === 404) {
			throw error(404, `Agent with ID "${agentId}" not found.`);
		}
		throw error(response.status, `Failed to fetch agent: ${response.statusText}`);
	}

	const data = await response.json();

	return {
		agent: {
			id: agentId,
			name: data.name,
			systemPrompt:
				data.conversation_config?.agent?.prompt?.prompt || 'No system prompt configured.'
		}
	};
};
