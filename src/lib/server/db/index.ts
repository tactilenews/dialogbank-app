import { PGlite } from "@electric-sql/pglite";
import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle as drizzleNeonHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { env } from "$env/dynamic/private";
import * as schema from "./schema";

const isVitest = process.env.VITEST === "true" || process.env.VITEST === "1";
if (!isVitest && !env.DATABASE_URL) throw new Error("DATABASE_URL is not set");

function createNeonHttpDb() {
	if (!env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
	// Configure for local development/testing with Neon Proxy
	if (env.DATABASE_URL.includes("localhost") || env.DATABASE_URL.includes("127.0.0.1")) {
		// HTTP Mode (recommended for most applications)
		neonConfig.fetchEndpoint = "http://localhost:5432/sql"; // Routes HTTP requests to local proxy
		neonConfig.poolQueryViaFetch = true; // Enables HTTP connection pooling
	}

	const client = neon(env.DATABASE_URL);
	return drizzleNeonHttp(client, { schema });
}

function createPgliteDb() {
	const client = new PGlite();
	return drizzlePglite(client, { schema });
}

export const db = isVitest ? createPgliteDb() : createNeonHttpDb();

type DbClient = typeof db;
type QueryLike<T = unknown> = PromiseLike<T>;

export async function dbAtomic(
	build: (client: DbClient) => readonly QueryLike[],
): Promise<unknown[]> {
	if ("batch" in db && typeof db.batch === "function") {
		return db.batch(build(db));
	}

	if ("transaction" in db && typeof db.transaction === "function") {
		return db.transaction(async (tx) => {
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
