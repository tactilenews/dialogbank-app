import { betterAuth } from "better-auth/minimal";
import { reset } from "drizzle-seed";
import { getAuth } from "$lib/server/auth";
import { getDb } from "$lib/server/db";
import * as schema from "$lib/server/db/schema";

function getSeedPassword(): string {
	const password = process.env.SEED_USER_PASSWORD?.trim();

	if (!password) {
		throw new Error("SEED_USER_PASSWORD must be set before running db:seed.");
	}

	return password;
}

const baseAuth = getAuth(getDb(), {
	ORIGIN: "http://localhost:5173",
	BETTER_AUTH_SECRET: "development-only-better-auth-secret",
});
const auth = betterAuth({
	...baseAuth.options,
	...{
		emailAndPassword: {
			enabled: true,
			disableSignUp: false,
		},
		plugins: undefined,
	},
});

const db = getDb();
await reset(db, schema); // Wipes existing data

await auth.api.signUpEmail({
	body: {
		email: "user@example.org",
		password: getSeedPassword(),
		name: "John Doe",
	},
});
