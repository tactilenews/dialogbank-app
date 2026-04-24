import { rmSync } from "node:fs";
import {
	createElevenLabsBranchClient,
	deleteElevenLabsBranch,
	ELEVENLABS_SNAPSHOT_PATH,
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

	rmSync(ELEVENLABS_SNAPSHOT_PATH, { force: true });
}

await main();
