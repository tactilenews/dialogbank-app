import * as Sentry from "@sentry/sveltekit";
import type { Handle } from "@sveltejs/kit";
import { sequence } from "@sveltejs/kit/hooks";
import { svelteKitHandler } from "better-auth/svelte-kit";
import { building } from "$app/environment";
import { env } from "$env/dynamic/private";
import { backfillLegacyAssignmentAgent } from "$lib/server/assignments";
import { getAuth } from "$lib/server/auth";
import { getDb } from "$lib/server/db";
import * as schema from "$lib/server/db/schema";

export const handleError = Sentry.handleErrorWithSentry();

let legacyAgentBackfill: Promise<void> | undefined;

const handleDb: Handle = async ({ event, resolve }) => {
	event.locals.db = getDb();
	event.locals.schema = schema;
	if (!building) {
		legacyAgentBackfill ??= backfillLegacyAssignmentAgent(event.locals.db, {
			ELEVENLABS_AGENT_ID: env.ELEVENLABS_AGENT_ID,
		});
		await legacyAgentBackfill;
	}

	return resolve(event);
};

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	const origin = env.ORIGIN ?? env.URL ?? event.url.origin;
	if (!origin) {
		throw new Error("ORIGIN is not set");
	}
	if (!env.BETTER_AUTH_SECRET) {
		throw new Error("BETTER_AUTH_SECRET is not set");
	}

	const auth = getAuth(event.locals.db, {
		ORIGIN: origin,
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
