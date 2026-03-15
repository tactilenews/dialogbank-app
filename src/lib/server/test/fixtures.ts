import type { RequestEvent } from "@sveltejs/kit";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as seed from "drizzle-seed";
import { test as baseTest, beforeAll, describe } from "vitest";
import { getAuth } from "$lib/server/auth";
import { getDb } from "$lib/server/db";
import * as schema from "$lib/server/db/schema";

const db = getDb();
const auth = getAuth(db, {
	ORIGIN: "http://localhost:4173",
	BETTER_AUTH_SECRET: "test-only-better-auth-secret",
});

export const it = baseTest.extend<{ db: typeof db; schema: typeof schema; auth: typeof auth }>({
	// biome-ignore lint/correctness/noEmptyPattern: Vitest fixture requires destructuring pattern
	db: async ({}, use) => {
		await use(db);
		await seed.reset(db, schema);
	},
	// biome-ignore lint/correctness/noEmptyPattern: Vitest fixture requires destructuring pattern
	auth: async ({}, use) => {
		await use(auth);
		await seed.reset(db, schema);
	},
	// biome-ignore lint/correctness/noEmptyPattern: Vitest fixture requires destructuring pattern
	schema: async ({}, use) => {
		await use(schema);
	},
});

beforeAll(async () => {
	await migrate(db as PgliteDatabase<typeof schema>, { migrationsFolder: "drizzle" });
});

type CreateRequestEventInput<RouteId extends RequestEvent["route"]["id"]> = {
	request: Request;
	locals: App.Locals;
	url?: URL;
	params?: Record<string, never>;
	routeId?: RouteId;
};

export function createRequestEvent<
	RouteId extends RequestEvent["route"]["id"] = RequestEvent["route"]["id"],
>({
	request,
	locals,
	url,
	params,
	routeId,
}: CreateRequestEventInput<RouteId>): RequestEvent<Record<string, never>, RouteId> {
	const tracing = {
		enabled: false,
		root: {} as RequestEvent["tracing"]["root"],
		current: {} as RequestEvent["tracing"]["current"],
	};
	return {
		request,
		locals,
		cookies: {
			get: () => undefined,
			getAll: () => [],
			set: () => {},
			delete: () => {},
			serialize: () => "",
		},
		fetch: globalThis.fetch,
		getClientAddress: () => "127.0.0.1",
		isDataRequest: false,
		isRemoteRequest: false,
		isSubRequest: false,
		tracing,
		platform: undefined,
		params: params ?? {},
		route: { id: (routeId ?? null) as RouteId },
		setHeaders: () => {},
		url: url ?? new URL(request.url),
	};
}

export { describe };
