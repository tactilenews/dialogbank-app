import { describe, it } from "vitest";
import { ZodError } from "zod";
import { parseElevenLabsWebhook } from "./parsing";
import { samplePayload1, samplePayload2 } from "./parsing.spec/data";

describe("ElevenLabs Webhook Parser", () => {
	const mockPayload = {
		type: "post_call_transcription",
		data: {
			conversation_id: "conv-123",
			agent_id: "agent-456",
			analysis: {
				transcript_summary: "Summary",
				data_collection_results: {
					order_type: {
						data_collection_id: "order_type",
						value: "pizza",
						rationale: "User said pizza",
					},
				},
				call_successful: "success",
			},
		},
	};

	describe("parseElevenLabsWebhook", () => {
		it("returns strongly typed data from the payload", ({ expect }) => {
			const data = parseElevenLabsWebhook(mockPayload);

			expect(data.conversation.conversationId).toBe("conv-123");
			expect(data.conversation.agentId).toBe("agent-456");
			expect(data.conversation.callSuccessful).toBe("success");
			expect(data.conversation.summary).toBe("Summary");

			expect(data.answers).toHaveLength(1);
			const result = data.answers[0];
			expect(result.dataCollectionId).toBe("order_type");
			expect(result.value).toBe("pizza");
			expect(result.rationale).toBe("User said pizza");
		});

		it("throws ZodError if payload is invalid", ({ expect }) => {
			const invalidPayload = { type: "wrong_type" };
			expect(() => parseElevenLabsWebhook(invalidPayload)).toThrow(ZodError);
		});

		it("returns an empty array if data_collection_results is empty", ({ expect }) => {
			const emptyPayload = {
				...mockPayload,
				data: {
					...mockPayload.data,
					analysis: {
						...mockPayload.data.analysis,
						data_collection_results: {},
					},
				},
			};
			const { answers } = parseElevenLabsWebhook(emptyPayload);
			expect(answers).toHaveLength(0);
		});

		it("parses real sample data (samplePayload1 - empty results)", ({ expect }) => {
			const data = parseElevenLabsWebhook(samplePayload1);

			expect(data.conversation.conversationId).toBe("conv_4401kjbexa6tfnz97e45sy0666d9");
			expect(data.answers).toHaveLength(0);
		});

		it("parses real sample data (samplePayload2 - with detailed records)", ({ expect }) => {
			const data = parseElevenLabsWebhook(samplePayload2);

			expect(data.conversation.conversationId).toBe("conv_7501kkbqgsfsfjf8smjkdsn7pt6q");
			expect(data.answers).toHaveLength(1);

			expect(data.conversation.firstName).toBe("Fritz");
			expect(data.conversation.lastName).toBe("Haarmaan");
			expect(data.conversation.age).toBe(49);
			expect(data.conversation.publicationAllowed).toBe(true);

			const answer1 = data.answers.find((r) => r.dataCollectionId === "answer_1");
			expect(answer1).toBeDefined();
			expect(answer1?.value).toBe("Sachsen");
			expect(answer1?.rationale).toContain("Sachsen");
		});

		it("parses publication_allowed field", ({ expect }) => {
			const payload = {
				type: "post_call_transcription",
				data: {
					conversation_id: "conv_test",
					agent_id: "agent_test",
					analysis: {
						transcript_summary: null,
						call_successful: null,
						data_collection_results: {
							publication_allowed: {
								data_collection_id: "publication_allowed",
								value: true,
								rationale: "User consented",
							},
						},
					},
				},
			};

			const result = parseElevenLabsWebhook(payload);

			expect(result.conversation.publicationAllowed).toBe(true);
			expect(result.answers).toHaveLength(0);
		});

		it("handles publication not allowed (false value)", ({ expect }) => {
			const payload = {
				type: "post_call_transcription",
				data: {
					conversation_id: "conv_test",
					agent_id: "agent_test",
					analysis: {
						transcript_summary: null,
						call_successful: null,
						data_collection_results: {
							publication_allowed: {
								data_collection_id: "publication_allowed",
								value: false,
								rationale: "User did not consent",
							},
						},
					},
				},
			};

			const result = parseElevenLabsWebhook(payload);

			expect(result.conversation.publicationAllowed).toBe(false);
			expect(result.answers).toHaveLength(0);
		});

		it("defaults publicationAllowed to null when field is missing (e.g. conversation ended earlier)", ({
			expect,
		}) => {
			const payload = {
				type: "post_call_transcription",
				data: {
					conversation_id: "conv_test",
					agent_id: "agent_test",
					analysis: {
						transcript_summary: null,
						call_successful: null,
						data_collection_results: {
							first_name: {
								data_collection_id: "first_name",
								value: "Test",
								rationale: "Test",
							},
						},
					},
				},
			};

			const result = parseElevenLabsWebhook(payload);

			expect(result.conversation.publicationAllowed).toBe(null);
		});

		it("sets publicationAllowed to null when field is explicitly null", ({ expect }) => {
			const payload = {
				type: "post_call_transcription",
				data: {
					conversation_id: "conv_test",
					agent_id: "agent_test",
					analysis: {
						transcript_summary: null,
						call_successful: null,
						data_collection_results: {
							publication_allowed: {
								data_collection_id: "publication_allowed",
								value: null,
								rationale: "User did not answer yet",
							},
						},
					},
				},
			};

			const result = parseElevenLabsWebhook(payload);

			expect(result.conversation.publicationAllowed).toBe(null);
		});
	});
});
