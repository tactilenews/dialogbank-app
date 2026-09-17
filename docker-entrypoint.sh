#!/bin/sh
set -eu

pnpm run db:migrate

exec "$@"
