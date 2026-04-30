import { existsSync, readFileSync } from "node:fs";
import { test as base } from "@playwright/test";
import * as seed from "drizzle-seed";
import { auth } from "./auth";
import { db, schema } from "./db";
import {
	type AgentSnapshot,
	createElevenLabsBranchClient,
	ELEVENLABS_SNAPSHOT_PATH,
	resolveElevenLabsBranchContext,
	restoreAgentSnapshot,
} from "./elevenlabs-branch";

type Fixtures = {
	db: typeof db;
	auth: typeof auth;
	elevenLabsBranch: undefined;
};

export const test = base.extend<Fixtures>({
	// biome-ignore lint/correctness/noEmptyPattern: Playwright fixture requires destructuring pattern
	db: async ({}, use) => {
		await db
			.insert(schema.assignments)
			.values({ id: 1, name: "Standard", isActive: true })
			.onConflictDoNothing();
		await use(db);
		await seed.reset(db, schema);
	},
	// biome-ignore lint/correctness/noEmptyPattern: Playwright fixture requires destructuring pattern
	auth: async ({}, use) => {
		await use(auth);
		await seed.reset(db, schema);
	},
	// biome-ignore lint/correctness/noEmptyPattern: Playwright fixture requires destructuring pattern
	elevenLabsBranch: async ({}, use) => {
		if (!existsSync(ELEVENLABS_SNAPSHOT_PATH)) {
			throw new Error(
				`ElevenLabs agent snapshot not found at ${ELEVENLABS_SNAPSHOT_PATH}. Run tests via test-e2e.sh.`,
			);
		}
		const snapshot = JSON.parse(readFileSync(ELEVENLABS_SNAPSHOT_PATH, "utf-8")) as AgentSnapshot;
		const context = resolveElevenLabsBranchContext(process.env);
		const client = createElevenLabsBranchClient(context.apiKey);
		const branchId = process.env.ELEVENLABS_AGENT_BRANCH_ID;
		if (!branchId) {
			throw new Error("ELEVENLABS_AGENT_BRANCH_ID is not set");
		}
		await restoreAgentSnapshot(client, context.agentId, branchId, snapshot);
		await use(undefined);
	},
});

test.beforeAll(async () => {
	await seed.reset(db, schema);
});

export { expect } from "@playwright/test";
