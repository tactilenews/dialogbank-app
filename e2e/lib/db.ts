import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../../src/lib/server/db/schema";

// Defaults to the dedicated e2e database published on the host at port 5433.
// Override E2E_DATABASE_URL when the database is reachable elsewhere, e.g.
// from another container.
const E2E_DATABASE_URL =
	process.env.E2E_DATABASE_URL ?? "postgres://user:password@localhost:5433/neondb";

// The local Neon proxy serves its HTTP endpoint on the same host and port as
// the connection string.
neonConfig.fetchEndpoint = `http://${new URL(E2E_DATABASE_URL).host}/sql`;
neonConfig.poolQueryViaFetch = true;

const client = neon(E2E_DATABASE_URL);

export const db = drizzle(client, { schema });
export { schema };
