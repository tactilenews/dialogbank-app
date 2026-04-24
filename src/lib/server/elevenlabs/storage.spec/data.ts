import type { ElevenLabsWebhookPayload } from "../parsing";

/**
 * Sample ElevenLabs webhook payloads for testing purposes.
 * These are based on real debugging data with ommitted transcripts.
 */

export const samplePayload1: ElevenLabsWebhookPayload = {
	type: "post_call_transcription",
	data: {
		conversation_id: "conv_4401kjbexa6tfnz97e45sy0666d9",
		agent_id: "agent_0501kjanbz0qe07rt0vnskaz2aag",
		analysis: {
			transcript_summary:
				"The user initiated the conversation in German and immediately requested to end the call.",
			data_collection_results: {},
			call_successful: "success",
		},
	},
};

/**
 * Latest sample payload with English field names.
 */
export const samplePayload2: ElevenLabsWebhookPayload = {
	type: "post_call_transcription",
	data: {
		conversation_id: "conv_7501kkbqgsfsfjf8smjkdsn7pt6q",
		agent_id: "agent_0501kjanbz0qe07rt0vnskaz2aag",
		analysis: {
			transcript_summary: "The conversation began with the WDR AI agent, Nadia...",
			data_collection_results: {
				first_name: {
					data_collection_id: "first_name",
					value: "Fritz",
					rationale: 'Der Benutzer gibt seinen Vornamen als "Fritz" an.',
				},
				last_name: {
					data_collection_id: "last_name",
					value: "Haarmaan",
					rationale: "Der Benutzer gibt seinen vollständigen Namen als 'Fritz Haarmaan' an.",
				},
				age: {
					data_collection_id: "age",
					value: 49,
					rationale: 'Der Benutzer gibt sein Alter mit "49 Jahre" an.',
				},
				publication_allowed: {
					data_collection_id: "publication_allowed",
					value: true,
					rationale: "Der Nutzer hat mit 'Ja klar' geantwortet.",
				},
				answer_1: {
					data_collection_id: "answer_1",
					value: "Sachsen",
					rationale: "Der Nutzer antwortet mit 'Bin aus Sachsen'.",
				},
			},
			call_successful: "success",
		},
	},
};

export const samplePayload3: ElevenLabsWebhookPayload = {
	type: "post_call_transcription",
	data: {
		conversation_id: "conv_classification_test",
		agent_id: "agent_test",
		analysis: {
			transcript_summary: "Test conversation with classification",
			data_collection_results: {
				question_0: {
					data_collection_id: "question_0",
					value: "Ich hätte gerne mehr Grünflächen in der Innenstadt.",
					rationale: "Der Nutzer beschreibt seine Idee.",
				},
				classification_0: {
					data_collection_id: "classification_0",
					value: "idee-fuer-gelsenkirchen",
					rationale: "Die Antwort ist eine Idee für Gelsenkirchen.",
				},
			},
			call_successful: "success",
		},
	},
};

export const samplePayload4: ElevenLabsWebhookPayload = {
	type: "post_call_transcription",
	data: {
		conversation_id: "conv_duplicate_classification_test",
		agent_id: "agent_test",
		analysis: {
			transcript_summary: "Test conversation with duplicate classifications",
			data_collection_results: {
				question_0: {
					data_collection_id: "question_0",
					value: "Mehr Baeume in der Innenstadt.",
					rationale: "Der Nutzer beschreibt seine Idee.",
				},
				classification_0: {
					data_collection_id: "classification_0",
					value: "idee-fuer-gelsenkirchen",
					rationale: "Die Antwort ist eine Idee fuer Gelsenkirchen.",
				},
				question_1: {
					data_collection_id: "question_1",
					value: "Mehr Sitzbaenke im Park.",
					rationale: "Der Nutzer beschreibt eine weitere Idee.",
				},
				classification_1: {
					data_collection_id: "classification_1",
					value: "idee-fuer-gelsenkirchen",
					rationale: "Die Antwort ist ebenfalls eine Idee fuer Gelsenkirchen.",
				},
			},
			call_successful: "success",
		},
	},
};

export const samplePayloads: ElevenLabsWebhookPayload[] = [samplePayload1, samplePayload2];
