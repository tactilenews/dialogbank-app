# Dialogbank App

Dialogbank is a SvelteKit application for collecting structured interview data from an ElevenLabs conversational agent and publishing the resulting answers.

Today, the app supports four core jobs:

- Editors can inspect the configured ElevenLabs agent from the UI. Editing that configuration in-app is planned but not built yet.
- The server accepts ElevenLabs post-call webhooks, verifies their signatures, and stores conversations plus extracted answers.
- Public pages display answers given by interviewed people.
- Authenticated editors can inspect collected data and manually classify answers.

## Product Overview

The main user-facing areas are:

- Public answer display for published interview output.
- An authenticated editor area for dashboards, review, and manual classification.
- A webhook endpoint that ingests post-call data from ElevenLabs.
- An agent inspection page that confirms which ElevenLabs agent the app is wired to.

## Tech Stack

- SvelteKit with TypeScript
- Better Auth for editor sign-in
- Drizzle ORM
- Neon HTTP in production, development, and E2E
- PGlite for Vitest integration tests
- Netlify for deployment
- Sentry for error reporting, server-side payload logging, and source map upload
- Infisical for local development, production secret sync to Netlify, and test secret sync to GitHub

## Environment Model

This project intentionally uses different database/runtime setups by environment:

- Production: Netlify serverless functions with Neon via `drizzle-orm/neon-http`
- Development: local Neon proxy container, reachable only from other containers (not published to the host)
- E2E: separate local Neon proxy/container on port `5433`
- Vitest integration tests: in-memory PGlite for fast, isolated tests

To avoid branching write logic, the app uses a shared `dbAtomic` helper. In Neon HTTP environments it uses `batch`; in PGlite it uses `transaction`.

## Required Environment Variables

These variables are used by the application:

- `DATABASE_URL`: database connection string
- `BETTER_AUTH_SECRET`: Better Auth secret
- `ORIGIN`: canonical app URL used by auth; if omitted, the app falls back to `URL` or the incoming request origin
- `ELEVENLABS_API_KEY`: server-side API key used to read agent details
- `ELEVENLABS_AGENT_ID`: the ElevenLabs conversational agent wired to this app
- `ELEVENLABS_WEBHOOK_SECRET`: secret used to verify `ElevenLabs-Signature`
- `SENTRY_DSN`: server-side Sentry DSN
- `PUBLIC_SENTRY_DSN`: optional browser-side Sentry DSN
- `SENTRY_AUTH_TOKEN`: Sentry auth token used during Netlify builds for sourcemap upload
- `SENTRY_ORG`: Sentry organization slug used during Netlify builds
- `SENTRY_PROJECT`: Sentry project slug used during Netlify builds
- `SENTRY_RELEASE`: optional fallback release identifier when `COMMIT_REF` is unavailable

Infisical is the source of truth for application secrets:

- local development commands load `dev` secrets from Infisical
- test commands load `test` secrets from Infisical
- production secrets are synced from Infisical to Netlify
- test secrets needed by GitHub Actions are synced from Infisical into GitHub secret stores

## Local Development

Node and pnpm versions are pinned in [`mise.toml`](./mise.toml) and managed via [mise](https://mise.jdx.dev). Install mise, then let it install the pinned tool versions:

```sh
mise install
```

Install dependencies:

```sh
pnpm install
```

Start everything:

```sh
infisical run --env dev -- docker compose up
```

This starts four containers:

- `db`: the local Neon proxy. Its Postgres port is not published to the host — only other containers can reach it.
- `migrate`: waits for `db` to accept connections, applies any pending migrations, then exits. `web` and `studio` both wait for this to finish successfully before starting, instead of each applying migrations themselves — that would race two containers against the same pending migration.
- `web`: the dev server on `http://localhost:5173`.
- `studio`: [Drizzle Studio](https://orm.drizzle.team/drizzle-studio/overview) so you can browse the database from your host, bound to `127.0.0.1` only (it's an unauthenticated database UI). Open the URL printed in its logs (`docker compose logs studio`, typically `https://local.drizzle.studio?host=0.0.0.0`) in a browser.

`migrate` fails immediately (exit non-zero) if `DATABASE_URL` is missing or migrations fail, rather than letting `web`/`studio` start in a broken state — check `docker compose logs <service>` if a container isn't coming up.

After changing dependencies (`package.json` / `pnpm-lock.yaml`), just rebuild and restart: each container re-syncs `node_modules` at startup, since it lives in a volume that survives image rebuilds. If it ever ends up with stale packages anyway, start fresh with `infisical run --env dev -- docker compose up --build --renew-anon-volumes`.

Local development runs entirely in Docker; there is no host-based alternative, since the database is only reachable from inside the compose network. To run one-off commands against the dev database, use `docker compose run --rm` (not `exec` — a running container's already-started process won't see the container-internal database hostname rewrite that happens once at startup):

```sh
docker compose run --rm migrate
docker compose run --rm -e SEED_USER_ACCOUNTS="$(infisical secrets --env dev --path user-accounts -o json)" web pnpm run db:seed
```

Seeding needs one extra step because `pnpm run db:seed` needs account credentials that only the host's authenticated `infisical` CLI can read (the container has neither the CLI nor a session). The command above resolves them on the host as JSON and passes that in as a single env var instead — see [Database Seeding](#database-seeding) below.

Building and previewing a production bundle still runs on the host against the real database:

```sh
infisical run --env prod -- pnpm run build
infisical run --env prod -- pnpm run preview
```

Because development and E2E use `neon_local`, the local database starts as an ephemeral copy of production, so in the normal case there is nothing new to migrate — `migrate` is then a no-op.

## Testing

Commands that do not require runtime secrets can be run directly:

```sh
pnpm run test:unit -- --run
pnpm run check
```

Commands that need test environment secrets should run through Infisical:

```sh
infisical run --env test -- pnpm run test
infisical run --env test -- pnpm run test:e2e
```

Run the full E2E flow, including the dedicated E2E database, interactively in one step:

```sh
infisical run --env test -- docker compose -f compose.e2e.yaml up
```

This starts `db_e2e`, waits for it to accept connections, applies pending migrations, creates an ephemeral ElevenLabs agent branch, and opens [Playwright's UI mode](https://playwright.dev/docs/test-ui-mode) instead of running tests immediately — open `http://localhost:9323` to pick and run tests interactively. The ElevenLabs branch is deleted again once the container stops (including Ctrl-C).

The `e2e` container uses `network_mode: host` because the tests hard-code the database at `localhost:5433`. That only reaches the host's `localhost` on Linux, and on rootless Docker only when the daemon shares the host network namespace (observed working with `rootlesskit --net=slirp4netns --detach-netns`; other rootless network modes weren't tested). If `http://localhost:9323` isn't reachable on your setup, use the split flow below.

Alternatively, run the services and the test runner separately (useful for repeated local runs without rebuilding the container). Both commands use `--env test`, so `db_e2e` is branched from the test Neon project the tests expect, not the dev one:

```sh
infisical run --env test -- docker compose -f compose.e2e.yaml up db_e2e
infisical run --env test -- pnpm run test:e2e
```

## ElevenLabs Integration

The current ElevenLabs integration has two responsibilities:

1. Read the configured agent so editors can confirm which agent is active.
2. Receive post-call webhook payloads and persist structured conversation data.

### Agent Wiring

The editor agent page reads:

- `ELEVENLABS_API_KEY`
- `ELEVENLABS_AGENT_ID`

It fetches the agent from ElevenLabs and displays its name and system prompt in the editor UI.

### Webhook Wiring

Configure ElevenLabs to send post-call webhooks to:

```text
<ORIGIN>/webhook/elevenlabs/post-call
```

The app expects the `ElevenLabs-Signature` header and verifies it with `ELEVENLABS_WEBHOOK_SECRET`.

After verification, the payload is parsed and stored as:

- one conversation record
- zero or more extracted answer records tied to that conversation

When validating or debugging the webhook wiring, it can be useful to inspect the Sentry logs because the consumed webhook payload is logged there on the server.

If you are wiring a new agent to the app, the minimal setup is:

1. Create or choose the ElevenLabs conversational agent.
2. Set `ELEVENLABS_AGENT_ID` and `ELEVENLABS_API_KEY` in the app environment.
3. Configure the agent's post-call webhook URL to point to this app's `/webhook/elevenlabs/post-call` endpoint.
4. Copy the webhook signing secret into `ELEVENLABS_WEBHOOK_SECRET`.
5. Trigger a test conversation and confirm that the webhook produces stored conversation and answer data.

## Authentication

Editor access uses Better Auth with email/password sign-in. Sign-up is disabled. The app requires:

- `BETTER_AUTH_SECRET`
- `ORIGIN`

The server loads the session on each request and exposes authenticated editor pages under the `(authenticated)` route group.

## Sentry

Sentry is enabled on both server and client:

- Server-side Sentry is initialized in the SvelteKit server instrumentation and error hooks.
- Client-side Sentry is enabled when `PUBLIC_SENTRY_DSN` is present.
- `consola` is connected to Sentry so application logs can be forwarded consistently.
- The ElevenLabs webhook handler logs the received payload type and payload details to Sentry on the server.

This means:

- unhandled runtime errors in SvelteKit routes can be reported server-side
- browser-side errors can be reported when `PUBLIC_SENTRY_DSN` is configured
- consumed webhook payloads can be inspected in Sentry during the retention window available on the active plan

The server requires `SENTRY_DSN`, which is stored in Infisical and synced to the relevant runtime.

## Netlify

The app is configured for Netlify deployment with `@sveltejs/adapter-netlify`.

Relevant Netlify behavior in this repository:

- Netlify builds the app with `pnpm run build`
- Production deploys run `pnpm run db:migrate && pnpm run build`
- The Sentry Vite integration uploads sourcemaps during builds and uses `COMMIT_REF` as the release when available

In practice, Netlify receives the production runtime variables from Infisical sync, especially:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `ORIGIN`
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_AGENT_ID`
- `ELEVENLABS_WEBHOOK_SECRET`
- `SENTRY_DSN`
- `PUBLIC_SENTRY_DSN` if browser-side Sentry reporting is desired

To upload sourcemaps from Netlify builds, the deployment environment also needs:

- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`
- Netlify `COMMIT_REF` or a fallback `SENTRY_RELEASE` value so the release name can be set consistently

## CI and Secret Sync

GitHub Actions runs linting, type checking, unit tests, E2E tests, and production builds.

This repository includes a helper script that syncs selected secrets for GitHub-hosted automation:

```sh
infisical run --env test -- pnpm run sync:dependabot-secrets
```

By default, the script syncs test-related values such as:

- `DATABASE_URL`
- `ELEVENLABS_AGENT_ID`
- `ELEVENLABS_API_KEY`
- `NEON_API_KEY`
- `NEON_PROJECT_ID`
- `PARENT_BRANCH_ID`

This supports two distinct flows:

- production secrets are synced from Infisical to Netlify
- testing secrets are synced from Infisical to GitHub so workflows can run against the test environment

## Database Seeding

The seed script replaces the `user` table with the accounts stored in Infisical under the `user-accounts` path (one secret per account, `email` as the key and `password` as the value). It needs that list as JSON in `SEED_USER_ACCOUNTS` — resolved from Infisical directly, not through `infisical run`, since it isn't itself a stored secret:

```sh
SEED_USER_ACCOUNTS="$(infisical secrets --env dev --path user-accounts -o json)" infisical run --env dev -- pnpm run db:seed
```

To seed the Dockerized dev database instead, see [Local Development](#local-development) above.

## Project Status

Current state:

- Agent inspection is implemented.
- Webhook ingestion is implemented.
- Public answer display is implemented.
- Editor-side inspection and manual classification are implemented.
- Editor-side agent configuration through the UI is still future work.
