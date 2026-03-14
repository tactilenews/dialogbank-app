import { PGlite } from "@electric-sql/pglite";
import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle as drizzleNeonHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { env } from "$env/dynamic/private";
import * as schema from "./schema";

const isVitest = process.env.VITEST === "true" || process.env.VITEST === "1";

function createNeonHttpDb() {
	if (!env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
	// Configure for local development/testing with Neon Proxy
	if (env.DATABASE_URL.includes("localhost") || env.DATABASE_URL.includes("127.0.0.1")) {
		const url = new URL(env.DATABASE_URL);
		const port = url.port || "5432";
		// HTTP Mode (recommended for most applications)
		neonConfig.fetchEndpoint = `http://localhost:${port}/sql`; // Routes HTTP requests to local proxy
		neonConfig.poolQueryViaFetch = true; // Enables HTTP connection pooling
	}

	const client = neon(env.DATABASE_URL);
	return drizzleNeonHttp(client, { schema });
}

function createPgliteDb() {
	const client = new PGlite();
	return drizzlePglite(client, { schema });
}

export type DbClient = ReturnType<typeof createNeonHttpDb> | ReturnType<typeof createPgliteDb>;
let cachedDb: DbClient | null = null;

export function getDb(): DbClient {
	if (cachedDb) return cachedDb;
	const client = isVitest ? createPgliteDb() : createNeonHttpDb();
	cachedDb = client;
	return client;
}

type QueryLike<T = unknown> = PromiseLike<T>;
type QueryList = readonly [QueryLike, ...QueryLike[]];

export async function dbAtomic(
	client: DbClient,
	build: (client: DbClient) => QueryList,
): Promise<unknown[]> {
	/**
	 * Motivation:
	 * - Production/dev/e2e use Neon HTTP (recommended for serverless), which supports `batch` but not `transaction`.
	 * - Integration tests use PGlite for isolation, which supports `transaction` but not `batch`.
	 *
	 * `dbAtomic` provides a single API for multi-write operations and selects the best
	 * atomic mechanism available at runtime. If neither capability exists, it fails fast
	 * to avoid silent partial writes.
	 */
	if ("batch" in client && typeof client.batch === "function") {
		const queries = build(client);
		return (client as { batch: (items: readonly unknown[]) => Promise<unknown[]> }).batch(
			queries as readonly unknown[],
		);
	}

	if ("transaction" in client && typeof client.transaction === "function") {
		return (
			client as {
				transaction: <T>(fn: (tx: unknown) => Promise<T>) => Promise<T>;
			}
		).transaction(async (tx) => {
			const queries = build(tx as DbClient);
			const results: unknown[] = [];
			for (const query of queries) {
				results.push(await query);
			}
			return results;
		});
	}

	throw new Error("dbAtomic requires a db adapter that supports batch or transaction.");
}
