import * as Sentry from "@sentry/sveltekit";
import consola from "consola";

Sentry.init({
	enableLogs: true,
});

const reporter = Sentry.createConsolaReporter();
consola.addReporter(reporter);
