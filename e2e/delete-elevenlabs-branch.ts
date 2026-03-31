import {
	createElevenLabsBranchClient,
	deleteElevenLabsBranch,
	resolveElevenLabsBranchContext,
} from "./lib/elevenlabs-branch.ts";

async function main() {
	const branchId = process.argv[2];
	if (!branchId) {
		throw new Error("Expected the ElevenLabs branch id as the first argument");
	}

	const context = resolveElevenLabsBranchContext(process.env);
	const client = createElevenLabsBranchClient(context.apiKey);

	await deleteElevenLabsBranch(client, context, branchId);
}

await main();
