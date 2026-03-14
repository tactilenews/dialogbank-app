import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth/minimal";
import { sveltekitCookies } from "better-auth/svelte-kit";
import { getRequestEvent } from "$app/server";
import { env } from "$env/dynamic/private";
import { getDb } from "$lib/server/db";

let cachedAuth: ReturnType<typeof betterAuth> | null = null;

export function getAuth(db = getDb()): ReturnType<typeof betterAuth> {
	if (cachedAuth) return cachedAuth;
	cachedAuth = betterAuth({
		baseURL: env.ORIGIN,
		secret: env.BETTER_AUTH_SECRET,
		database: drizzleAdapter(db, { provider: "pg" }),
		emailAndPassword: {
			enabled: true,
			disableSignUp: true,
		},
		plugins: [sveltekitCookies(getRequestEvent)], // make sure this is the last plugin in the array
	});
	return cachedAuth;
}
