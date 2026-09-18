import { betterAuth } from "better-auth/minimal";
import { getAuth } from "$lib/server/auth";
import { getDb } from "$lib/server/db";
import { user } from "$lib/server/db/schema";

type InfisicalSecret = { secretKey: string; secretValue: string };

function getUserAccounts(): Array<{ email: string; password: string }> {
	const raw = process.env.SEED_USER_ACCOUNTS;
	if (!raw) {
		throw new Error(
			"SEED_USER_ACCOUNTS must be set to the JSON array from " +
				'`infisical secrets --path user-accounts -o json`. Run via: ' +
				'SEED_USER_ACCOUNTS="$(infisical secrets --env dev --path user-accounts -o json)" ' +
				"infisical run --env dev -- pnpm run db:seed",
		);
	}

	const secrets = JSON.parse(raw) as InfisicalSecret[];
	return secrets.map(({ secretKey, secretValue }) => ({ email: secretKey, password: secretValue }));
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

const accounts = getUserAccounts();

await db.delete(user);
for (const { email, password } of accounts) {
	const name = email.split("@")[0];
	await auth.api.signUpEmail({ body: { email, password, name } });
	console.log(`Created user: ${email}`);
}
