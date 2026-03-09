import { env } from '$env/dynamic/public';
import consola from 'consola';
import * as Sentry from '@sentry/sveltekit';

Sentry.init({
	dsn: env.PUBLIC_SENTRY_DSN,
	enableLogs: true
});

export const handleError = Sentry.handleErrorWithSentry();
const reporter = Sentry.createConsolaReporter();
consola.addReporter(reporter);
