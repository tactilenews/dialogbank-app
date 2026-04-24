import { writeFileSync } from "node:fs";
import {
	createElevenLabsBranchClient,
	createEphemeralElevenLabsBranch,
	ELEVENLABS_SNAPSHOT_PATH,
	fetchAgentSnapshot,
	resolveElevenLabsBranchContext,
} from "./lib/elevenlabs-branch.ts";

async function main() {
	const context = resolveElevenLabsBranchContext(process.env);
	const client = createElevenLabsBranchClient(context.apiKey);
	const branchId = await createEphemeralElevenLabsBranch(client, context);

	const snapshot = await fetchAgentSnapshot(client, context.agentId, branchId);
	writeFileSync(ELEVENLABS_SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2));

	process.stdout.write(branchId);
}

await main();
