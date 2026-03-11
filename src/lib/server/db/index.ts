import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { env } from "$env/dynamic/private";
import * as schema from "./schema";

if (!env.DATABASE_URL) throw new Error("DATABASE_URL is not set");

// Configure for local development/testing with Neon Proxy
if (env.DATABASE_URL.includes("localhost") || env.DATABASE_URL.includes("127.0.0.1")) {
	// HTTP Mode (recommended for most applications)
	neonConfig.fetchEndpoint = "http://localhost:5432/sql"; // Routes HTTP requests to local proxy
	neonConfig.poolQueryViaFetch = true; // Enables HTTP connection pooling
}

const client = neon(env.DATABASE_URL);

export const db = drizzle(client, { schema });
