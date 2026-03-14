import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth/minimal";
import { sveltekitCookies } from "better-auth/svelte-kit";
import { getRequestEvent } from "$app/server";
import { env } from "$env/dynamic/private";
import type { DbClient } from "$lib/server/db";

export function getAuth(db: DbClient) {
	return betterAuth({
		baseURL: env.ORIGIN,
		secret: env.BETTER_AUTH_SECRET,
		database: drizzleAdapter(db, { provider: "pg" }),
		emailAndPassword: {
			enabled: true,
			disableSignUp: true,
		},
		plugins: [sveltekitCookies(getRequestEvent)], // make sure this is the last plugin in the array
	});
}
