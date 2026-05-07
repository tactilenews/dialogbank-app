import { execSync } from "node:child_process";
import { betterAuth } from "better-auth/minimal";
import { getAuth } from "$lib/server/auth";
import { getDb } from "$lib/server/db";
import { user } from "$lib/server/db/schema";

function getUserAccounts(): Array<{ email: string; password: string }> {
	const output = execSync("infisical secrets --path user-accounts --plain").toString();
	return output
		.trim()
		.split("\n")
		.map((line) => {
			const eq = line.indexOf("=");
			return { email: line.slice(0, eq), password: line.slice(eq + 1) };
		});
}

const db = getDb();

const betterAuthSecret = process.env.BETTER_AUTH_SECRET;
if (!betterAuthSecret) {
	throw new Error("BETTER_AUTH_SECRET must be set. Run via: infisical run -- pnpm db:seed");
}

const baseAuth = getAuth(db, {
	ORIGIN: process.env.ORIGIN ?? "http://localhost:5173",
	BETTER_AUTH_SECRET: betterAuthSecret,
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

await db.delete(user);

const accounts = getUserAccounts();
for (const { email, password } of accounts) {
	const name = email.split("@")[0];
	await auth.api.signUpEmail({ body: { email, password, name } });
	console.log(`Created user: ${email}`);
}
