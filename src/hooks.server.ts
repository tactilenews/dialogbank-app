import * as Sentry from "@sentry/sveltekit";
import type { Handle } from "@sveltejs/kit";
import { sequence } from "@sveltejs/kit/hooks";
import { svelteKitHandler } from "better-auth/svelte-kit";
import { building } from "$app/environment";
import { env } from "$env/dynamic/private";
import { getAuth } from "$lib/server/auth";
import { getDb } from "$lib/server/db";
import * as schema from "$lib/server/db/schema";

export const handleError = Sentry.handleErrorWithSentry();

const handleDb: Handle = async ({ event, resolve }) => {
	event.locals.db = getDb();
	event.locals.schema = schema;

	return resolve(event);
};

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	if (!env.ORIGIN) {
		throw new Error("ORIGIN is not set");
	}
	if (!env.BETTER_AUTH_SECRET) {
		throw new Error("BETTER_AUTH_SECRET is not set");
	}

	const auth = getAuth(event.locals.db, {
		ORIGIN: env.ORIGIN,
		BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET,
	});
	event.locals.auth = auth;

	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

export const handle: Handle = sequence(Sentry.sentryHandle(), handleDb, handleBetterAuth);
