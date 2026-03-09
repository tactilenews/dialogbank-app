import { type ElevenLabsWebhookPayload } from '../parsing';

/**
 * Sample ElevenLabs webhook payloads for testing purposes.
 * These are based on real debugging data with ommitted transcripts.
 */

export const samplePayload1: ElevenLabsWebhookPayload = {
	type: 'post_call_transcription',
	data: {
		conversation_id: 'conv_4401kjbexa6tfnz97e45sy0666d9',
		agent_id: 'agent_0501kjanbz0qe07rt0vnskaz2aag',
		analysis: {
			transcript_summary:
				'The user initiated the conversation in German and immediately requested to end the call.',
			data_collection_results: {},
			call_successful: 'success'
		}
	}
};

export const samplePayload2: ElevenLabsWebhookPayload = {
	type: 'post_call_transcription',
	data: {
		conversation_id: 'conv_2201kjqpnmwmfmvb42nam7v1ghrw',
		agent_id: 'agent_0501kjanbz0qe07rt0vnskaz2aag',
		analysis: {
			transcript_summary: 'Nadia, a virtual WDR editor, initiated a conversation with Heinz...',
			data_collection_results: {
				Vorname: {
					data_collection_id: 'Vorname',
					value: 'Heinz',
					rationale: 'Der Benutzer gibt seinen Vornamen als "Heinz" an.'
				},
				Nachname: {
					data_collection_id: 'Nachname',
					value: null,
					rationale: 'Der Nutzer gibt nur seinen Vornamen "Heinz" an.'
				},
				Alter: {
					data_collection_id: 'Alter',
					value: null,
					rationale: 'Der Benutzer hat sein Alter nicht genannt.'
				},
				'Zitat-Erlaubnis': {
					data_collection_id: 'Zitat-Erlaubnis',
					value: false,
					rationale: 'Der Nutzer hat in der Konversation explizit "nein" gesagt.'
				},
				Antworten: {
					data_collection_id: 'Antworten',
					value: 'Heinz, Ich bin gerade in Köln und das Wetter ist sonnig., nö, nein, nein',
					rationale: 'Die Antworten des Nutzers auf die Fragen des Agenten.'
				}
			},
			call_successful: 'success'
		}
	}
};

export const samplePayloads: ElevenLabsWebhookPayload[] = [samplePayload1, samplePayload2];
