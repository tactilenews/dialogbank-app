import type { User, Session } from "better-auth/minimal";

type DbClient = typeof import("$lib/server/db").db;
type DbSchema = typeof import("$lib/server/db/schema");

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Locals {
			user?: User;
			session?: Session;
			db: DbClient;
			schema: DbSchema;
		}

		// interface Error {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}
