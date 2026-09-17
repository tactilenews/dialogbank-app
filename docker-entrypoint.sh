#!/bin/sh
set -eu

# DATABASE_URL comes from Infisical pointed at "localhost", which is correct
# for host-based `pnpm run dev` but not from inside this container, where the
# database is reachable via the compose service name instead.
if [ -n "${DATABASE_URL:-}" ]; then
	DATABASE_URL=$(echo "$DATABASE_URL" | sed 's/@localhost:/@db:/')
	export DATABASE_URL
fi

pnpm run db:migrate

exec "$@"
