#!/bin/sh
set -eu

# DATABASE_URL comes from Infisical pointed at "localhost", which is correct
# for host-based `pnpm run dev` but not from inside this container, where the
# database is reachable via the compose service name instead. Set DB_HOST to
# that service name; leave it unset (e.g. for network_mode: host) to keep
# DATABASE_URL as-is.
if [ -n "${DATABASE_URL:-}" ] && [ -n "${DB_HOST:-}" ]; then
	DATABASE_URL=$(echo "$DATABASE_URL" | sed "s/@localhost:/@${DB_HOST}:/")
	export DATABASE_URL
fi

pnpm run db:migrate

exec "$@"
