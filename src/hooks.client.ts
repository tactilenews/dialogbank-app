import * as Sentry from "@sentry/sveltekit";
import consola from "consola";
import { env } from "$env/dynamic/public";

if (env.PUBLIC_SENTRY_DSN) {
	Sentry.init({
		dsn: env.PUBLIC_SENTRY_DSN,
		enableLogs: true,
	});
}

export const handleError = Sentry.handleErrorWithSentry();
const reporter = Sentry.createConsolaReporter();
consola.addReporter(reporter);
