import { expect, test } from "./lib/fixtures";
import { createElevenLabsSignature } from "./lib/webhook";

test.describe("ElevenLabs Webhook E2E", () => {
	test("successfully processes a signed webhook payload and stores answers", async ({
		db,
		request,
	}) => {
		const payload = {
			type: "post_call_transcription",
			data: {
				conversation_id: "e2e-conv-fritz",
				agent_id: "e2e-agent-fritz",
				analysis: {
					transcript_summary: "Fritz interview summary",
					data_collection_results: {
						first_name: {
							data_collection_id: "first_name",
							value: "Fritz",
							rationale: "Said Fritz",
						},
						last_name: {
							data_collection_id: "last_name",
							value: "Haarmaan",
							rationale: "Said Haarmaan",
						},
						age: {
							data_collection_id: "age",
							value: 49,
							rationale: "Said 49",
						},
						publication_allowed: {
							data_collection_id: "publication_allowed",
							value: true,
							rationale: "Agreed",
						},
						favorite_color: {
							data_collection_id: "favorite_color",
							value: "blue",
							rationale: "Said blue",
						},
					},
					call_successful: "success",
				},
			},
		};

		const body = JSON.stringify(payload);
		const signatureHeader = createElevenLabsSignature(body);

		const response = await request.post("/webhook/elevenlabs/post-call", {
			data: body,
			headers: {
				"Content-Type": "application/json",
				"ElevenLabs-Signature": signatureHeader,
			},
		});

		await expect(response.json()).resolves.toEqual({ success: true });

		// Verify database records
		const storedConversation = await db.query.conversations.findFirst({
			where: (conv, { eq }) => eq(conv.conversationId, "e2e-conv-fritz"),
		});

		expect(storedConversation).toBeDefined();
		if (!storedConversation) {
			throw new Error("storedConversation is undefined");
		}
		expect(storedConversation).toMatchObject({
			agentId: "e2e-agent-fritz",
			conversationId: "e2e-conv-fritz",
			firstName: "Fritz",
			lastName: "Haarmaan",
			age: 49,
			publicationAllowed: true,
			callSuccessful: "success",
			summary: "Fritz interview summary",
		});

		const storedAnswers = await db.query.answers.findMany({
			where: (answers, { eq }) => eq(answers.conversationId, storedConversation.conversationId),
		});

		expect(storedAnswers).toHaveLength(1);
		expect(storedAnswers[0]).toMatchObject({
			dataCollectionId: "favorite_color",
			value: "blue",
			rationale: "Said blue",
		});
	});
});
