import { z } from "zod";

/**
 * Zod schema for the JSON schema part of data collection results.
 */
const DataCollectionJsonSchema = z.object({
	type: z.string(),
	description: z.string().optional(),
	enum: z.array(z.string()).nullable().optional(),
	is_system_provided: z.boolean().optional(),
	dynamic_variable: z.string().optional(),
	constant_value: z.string().optional(),
});

/**
 * Zod schema for a single data collection result entry.
 */
export const elevenLabsDataPointSchema = z.object({
	data_collection_id: z.string(),
	value: z.union([z.string(), z.number(), z.boolean()]).nullable(),
	json_schema: DataCollectionJsonSchema.optional(),
	rationale: z.string(),
});

export type ElevenLabsDataPoint = z.infer<typeof elevenLabsDataPointSchema>;

/**
 * Single Zod schema for the entire ElevenLabs post-call transcription webhook payload.
 * Focuses on metadata and analysis results.
 */
export const elevenLabsWebhookSchema = z.object({
	type: z.literal("post_call_transcription"),
	data: z.object({
		conversation_id: z.string(),
		agent_id: z.string(),
		analysis: z.object({
			transcript_summary: z.string().optional().nullable(),
			data_collection_results: z.record(z.string(), elevenLabsDataPointSchema).default({}),
			call_successful: z.string().optional().nullable(),
		}),
	}),
});

export type ElevenLabsWebhookPayload = z.infer<typeof elevenLabsWebhookSchema>;

/**
 * Parses the ElevenLabs post-call transcription webhook payload.
 * Returns a strongly typed object structured for database insertion.
 */
export function parseElevenLabsWebhook(payload: unknown) {
	const validated = elevenLabsWebhookSchema.parse(payload);
	const { conversation_id, agent_id, analysis } = validated.data;

	const callSuccessful = analysis.call_successful ?? null;
	const summary = analysis.transcript_summary ?? null;

	// Map expected fields and other answers
	let firstName: string | null = null;
	let lastName: string | null = null;
	let age: number | null = null;
	let publicationAllowed = false;

	const otherAnswers: {
		dataCollectionId: string;
		value: string | null;
		rationale: string;
	}[] = [];

	const results = Object.values(analysis.data_collection_results);

	for (const result of results) {
		const id = result.data_collection_id.toLowerCase();
		const val = result.value;

		switch (id) {
			case "first_name":
				firstName = val as string;
				break;
			case "last_name":
				lastName = val as string;
				break;
			case "age":
				age = val as number;
				break;
			case "publication_allowed":
				publicationAllowed = val === true;
				break;
			default:
				otherAnswers.push({
					dataCollectionId: result.data_collection_id,
					value: val !== null ? String(val) : null,
					rationale: result.rationale,
				});
		}
	}

	return {
		conversation: {
			agentId: agent_id,
			conversationId: conversation_id,
			firstName,
			lastName,
			age,
			publicationAllowed,
			callSuccessful,
			summary,
		},
		answers: otherAnswers,
	};
}
