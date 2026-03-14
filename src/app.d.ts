import type { Session, User } from "better-auth/minimal";

type DbClient = ReturnType<typeof import("$lib/server/db").getDb>;
type DbSchema = typeof import("$lib/server/db/schema");
type Auth = ReturnType<typeof import("$lib/server/auth").getAuth>;

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Locals {
			user?: User;
			session?: Session;
			db: DbClient;
			schema: DbSchema;
			auth: Auth;
		}

		// interface Error {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}
