# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Environments

This project runs in multiple environments with intentionally different database setups:

- **Production**: Deployed on Netlify serverless functions, connecting to the production Neon database using `drizzle-orm/neon-http`. This matches the serverless runtime and supports `db.batch` but not `db.transaction`.
- **Development**: Uses the `neondatabase/neon_local` Docker container (on port 5432) to work against ephemeral branches seeded from production data.
- **E2E**: Uses a separate `neondatabase/neon_local` Docker container (on port 5433) to ensure that development data is not wiped out during tests.
- **Integration Tests (Vitest)**: Uses PGlite (`drizzle-orm/pglite`) for fast, isolated tests. The goal is speed and test isolation, without needing to replicate the full production stack.

To avoid branching application logic, multi-write operations go through `dbAtomic`, which selects the best atomic mechanism available at runtime (batch on Neon HTTP, transaction on PGlite). If neither capability is present, it throws to avoid silent partial writes.

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project
npx sv create my-app
```

To recreate this project with the same configuration:

```sh
# recreate this project
pnpm dlx sv@0.12.5 create --template minimal --types ts --add prettier eslint vitest="usages:unit,component" playwright tailwindcss="plugins:typography,forms" sveltekit-adapter="adapter:auto" devtools-json drizzle="database:postgresql+postgresql:neon" better-auth="demo:password" mdsvex storybook mcp="ide:gemini+setup:remote" --install pnpm ./
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

## Dependabot secrets

Dependabot-triggered workflow runs cannot read regular GitHub Actions secrets. This repository includes a sync script that copies selected values into the repository's Dependabot secret store.

Run it locally with Infisical-loaded environment variables:

```sh
infisical run --env test -- pnpm run sync:dependabot-secrets
```

Required environment variables:

- `GITHUB_TOKEN`, using a token that can manage repository Dependabot secrets
- The secret values to sync, by default:
  - `DATABASE_URL`
  - `ELEVENLABS_AGENT_ID`
  - `ELEVENLABS_API_KEY`
  - `NEON_API_KEY`
  - `NEON_PROJECT_ID`
  - `PARENT_BRANCH_ID`

Optional environment variables:

- `DEPENDABOT_SECRET_NAMES`, a comma-separated override list for which secret names to sync
