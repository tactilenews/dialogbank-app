import { drizzle } from 'drizzle-orm/neon-http';
import { neon, neonConfig } from '@neondatabase/serverless';
import * as schema from '../../src/lib/server/db/schema';

const { env } = process;

if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

// Configure for local development/testing with Neon Proxy
// HTTP Mode (recommended for most applications)
neonConfig.fetchEndpoint = 'http://localhost:5432/sql'; // Routes HTTP requests to local proxy
neonConfig.poolQueryViaFetch = true; // Enables HTTP connection pooling

const client = neon(env.DATABASE_URL);

export const db = drizzle(client, { schema });
export { schema };
