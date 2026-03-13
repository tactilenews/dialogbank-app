import { test as base } from "@playwright/test";
import * as seed from "drizzle-seed";
import { auth } from "./auth";
import { db, schema } from "./db";

type Fixtures = {
	db: typeof db;
	auth: typeof auth;
};

export const test = base.extend<Fixtures>({
	// biome-ignore lint/correctness/noEmptyPattern: Playwright fixture requires destructuring pattern
	db: async ({}, use) => {
		await use(db);
		await seed.reset(db, schema);
	},
	// biome-ignore lint/correctness/noEmptyPattern: Playwright fixture requires destructuring pattern
	auth: async ({}, use) => {
		await use(auth);
		await seed.reset(db, schema);
	},
});

test.beforeAll(async () => {
	await seed.reset(db, schema);
});

export { expect } from "@playwright/test";
