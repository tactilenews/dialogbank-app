import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from './db';

const { env } = process;

if (!env.BETTER_AUTH_SECRET) throw new Error('BETTER_AUTH_SECRET is not set');

export const auth = betterAuth({
	baseURL: 'http://localhost:4173',
	secret: env.BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, { provider: 'pg' }),
	emailAndPassword: {
		enabled: true,
		disableSignUp: false
	}
});
