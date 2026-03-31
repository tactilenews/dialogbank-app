import {
	createElevenLabsBranchClient,
	createEphemeralElevenLabsBranch,
	resolveElevenLabsBranchContext,
} from "./lib/elevenlabs-branch.ts";

async function main() {
	const context = resolveElevenLabsBranchContext(process.env);
	const client = createElevenLabsBranchClient(context.apiKey);
	const branchId = await createEphemeralElevenLabsBranch(client, context);

	process.stdout.write(branchId);
}

await main();
