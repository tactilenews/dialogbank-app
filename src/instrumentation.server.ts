import * as Sentry from "@sentry/sveltekit";
import consola from "consola";

Sentry.init({
	enableLogs: true,
	release: __SENTRY_RELEASE__ ?? undefined,
});

const reporter = Sentry.createConsolaReporter();
consola.addReporter(reporter);
