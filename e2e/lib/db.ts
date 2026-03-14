import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../../src/lib/server/db/schema";

const E2E_DATABASE_URL = "postgres://user:password@localhost:5433/neondb";

// Force e2e tests to use the dedicated e2e database on port 5433
neonConfig.fetchEndpoint = "http://localhost:5433/sql";
neonConfig.poolQueryViaFetch = true;

const client = neon(E2E_DATABASE_URL);

export const db = drizzle(client, { schema });
export { schema };
