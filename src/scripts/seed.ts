import { betterAuth } from "better-auth/minimal";
import { getAuth } from "$lib/server/auth";
import { getDb } from "$lib/server/db";
import { user } from "$lib/server/db/schema";

type InfisicalSecret = { secretKey: string; secretValue: string };

const SEED_USER_ACCOUNTS_HELP =
	"Run via: " +
	'SEED_USER_ACCOUNTS="$(infisical secrets --env dev --path user-accounts -o json)" ' +
	"infisical run --env dev -- pnpm run db:seed";

function getUserAccounts(): Array<{ email: string; password: string }> {
	const raw = process.env.SEED_USER_ACCOUNTS;
	if (!raw) {
		throw new Error(
			"SEED_USER_ACCOUNTS must be set to the JSON array from " +
				`\`infisical secrets --path user-accounts -o json\`. ${SEED_USER_ACCOUNTS_HELP}`,
		);
	}

	let secrets: InfisicalSecret[];
	try {
		secrets = JSON.parse(raw);
	} catch (cause) {
		throw new Error(`SEED_USER_ACCOUNTS is not valid JSON. ${SEED_USER_ACCOUNTS_HELP}`, { cause });
	}

	if (!Array.isArray(secrets) || secrets.length === 0) {
		throw new Error(
			`SEED_USER_ACCOUNTS must be a non-empty array; got ${JSON.stringify(secrets)}. ` +
				`Check the Infisical path/environment used to build it. ${SEED_USER_ACCOUNTS_HELP}`,
		);
	}

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
