import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth/minimal";
import { sveltekitCookies } from "better-auth/svelte-kit";
import { getRequestEvent } from "$app/server";
import type { DbClient } from "$lib/server/db";

export type AuthEnv = {
	ORIGIN: string;
	BETTER_AUTH_SECRET: string;
};

export function getAuth(db: DbClient, authEnv: AuthEnv) {
	return betterAuth({
		baseURL: authEnv.ORIGIN,
		secret: authEnv.BETTER_AUTH_SECRET,
		database: drizzleAdapter(db, { provider: "pg" }),
		emailAndPassword: {
			enabled: true,
			disableSignUp: true,
		},
		plugins: [sveltekitCookies(getRequestEvent)], // make sure this is the last plugin in the array
	});
}
