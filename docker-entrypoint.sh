#!/bin/sh
set -eu

# DATABASE_URL comes from Infisical pointed at "localhost", which is correct
# for host-based `pnpm run dev` but not from inside this container, where the
# database is reachable via the compose service name instead. Set DB_HOST to
# that service name; leave it unset (e.g. for network_mode: host) to keep
# DATABASE_URL as-is. Matches the hostname generically (whatever it is, with
# or without a port) rather than the literal "localhost:" text, so it also
# covers "127.0.0.1" or a default-port URL.
if [ -n "${DATABASE_URL:-}" ] && [ -n "${DB_HOST:-}" ]; then
	DATABASE_URL=$(echo "$DATABASE_URL" | sed -E "s#(@)[^:/]+#\1${DB_HOST}#")
	export DATABASE_URL
fi

# node_modules lives in an anonymous volume that Compose keeps across image
# rebuilds, so after a package.json/lockfile change the rebuilt image's
# dependencies are hidden behind the stale volume. Re-syncing here is a fast
# no-op when nothing changed. (Fallback if it ever gets stuck:
# `docker compose up --build --renew-anon-volumes`.)
pnpm install --frozen-lockfile

# Opt-in so multiple services depending on the same database (web, studio)
# don't race each other running migrations concurrently on startup. Set by
# the dedicated one-shot `migrate` service, or by services that are the only
# consumer of their database (e.g. e2e).
if [ "${RUN_MIGRATIONS:-}" = "true" ]; then
	pnpm run db:migrate
fi

exec "$@"
