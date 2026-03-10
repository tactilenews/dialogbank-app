import { auth as baseAuth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { reset } from 'drizzle-seed';
import { betterAuth } from 'better-auth/minimal';

const auth = betterAuth({
	...baseAuth.options,
	...{
		emailAndPassword: {
			enabled: true,
			disableSignUp: false
		},
		plugins: undefined
	}
});

await reset(db, schema); // Wipes existing data

await auth.api.signUpEmail({
	body: {
		email: 'user@example.org',
		password: '12341234',
		name: 'John Doe'
	}
});
