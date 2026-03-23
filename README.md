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
- Development: local Neon proxy/container on port `5432`
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

Install dependencies:

```sh
pnpm install
```

Start the local services:

```sh
infisical run --env dev -- docker compose up
```

Start the app:

```sh
infisical run --env dev -- pnpm run dev
```

Useful local commands:

```sh
infisical run --env dev -- pnpm run db:studio
infisical run --env dev -- pnpm run db:seed
infisical run --env prod -- pnpm run build
infisical run --env prod -- pnpm run preview
```

Because development and E2E use `neon_local`, the local database starts as an ephemeral copy of production. In the normal case, you do not need to run migrations after startup if production is already up to date.

Only run migrations when you have created new local migrations that are not yet reflected in the copied production schema:

```sh
infisical run --env dev -- pnpm run db:migrate
infisical run --env test -- pnpm run db:migrate
```

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

E2E tests also require the dedicated E2E services:

```sh
infisical run --env dev -- docker compose -f compose.e2e.yaml up
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

The seed script creates a default user with `user@example.org` and requires the password to be provided through `SEED_USER_PASSWORD`.

Example:

```sh
SEED_USER_PASSWORD='replace-me' infisical run --env dev -- pnpm run db:seed
```

## Project Status

Current state:

- Agent inspection is implemented.
- Webhook ingestion is implemented.
- Public answer display is implemented.
- Editor-side inspection and manual classification are implemented.
- Editor-side agent configuration through the UI is still future work.
