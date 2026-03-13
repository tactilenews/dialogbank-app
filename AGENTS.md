## Package Management

- **Development Dependencies**: Unless there is a good reason, always install new dependencies as a development dependency (`-D` or `--save-dev`) because Svelte/Vite handles bundling.

- **Language**: TypeScript
- **Package Manager**: pnpm
- **Add-ons**: biome, vitest, playwright, tailwindcss, sveltekit-adapter, devtools-json, drizzle, better-auth, mdsvex, storybook, mcp

## Coding Standards

- **Linting & Formatting**: Always run `pnpm run lint:fix` every time source files are changed to ensure consistent style and apply safe fixes.
- **Type Checking**: After source files are changed, run `pnpm run check` and fix any TypeScript errors.
- **TypeScript**: NEVER use the non-null assertion operator (`!`). Always use proper null checks, optional chaining, or type guards.

## Secrets & Environment Variables

- **Infisical**: All commands that require secrets (including `dev`, `build`, `preview`, `test`, `test:e2e`, and `db:*`) must be run using Infisical to provide environment variables.
  - **Usage**: `infisical run --env [env] -- [command]`
  - **Testing**: All test-related scripts (e.g., `test`, `test:e2e`, `vitest`) **must** be run with `--env test`.
  - Example: `infisical run --env dev -- pnpm dev`
  - Example: `infisical run --env test -- pnpm test:e2e`

## Running Tests

### E2E Tests

E2E tests must be run with Infisical to load environment variables:

```sh
infisical --env test run -- pnpm run test:e2e
```

This command:

- Uses Infisical to load secrets from the `test` environment
- Runs the e2e test suite using Playwright
- Requires a test database configured in Infisical

### Other Tests

All test-related scripts require Infisical:

```sh
# Unit/component tests
infisical --env test run -- pnpm run test

# Vitest watch mode
infisical --env test run -- pnpm run test:watch
```

## Database

For database operations, always use the appropriate environment:

```sh
# Development
infisical run --env dev -- pnpm run db:migrate

# Testing
infisical --env test run -- pnpm run db:migrate
```

## Documentation

- [ElevenLabs API Reference](https://elevenlabs.io/docs/api-reference/introduction)

## Testing Mandates

- **E2E Tests**: All E2E tests must be located in the top-level `e2e/` directory. They should be named with `.test.ts` or `.spec.ts` extensions.
- **Page Component Tests**: Use page component tests (`.svelte.spec.ts`) for testing page UI and component logic without database or navigation dependencies. Prefer these over E2E tests when:
  - No database interaction is needed
  - No cross-page navigation is being tested
  - You can pass mock data via props
- **Integration Tests**: Every component must have a co-located integration test file ending in `.spec.ts` (e.g., `src/lib/components/MyComponent.spec.ts`). For route pages (`+page.svelte`), an integration test should be used to test component logic in isolation.
- **Promise Expectations**: Always expect promises using `.resolves` (e.g., `await expect(promise).resolves.toEqual(...)`).
- **Test Fixtures**: Fixtures and sample data for tests must be co-located with the test file in a directory named after the test (e.g., `my.spec.ts` imports from `my.spec/data.ts`).

## E2E Testing Best Practices

### Database Fixture Isolation

- Tests using the `db` fixture parameter automatically trigger a `seed.reset()` before running
- Tests **without** the `db` parameter do not reset the database
- **Always add `db` parameter** to tests that need a clean database state, even if not directly using the database
- This ensures proper test isolation and prevents data leakage between tests

### Playwright Strict Mode

- Playwright enforces strict mode by default: selectors must match exactly one element
- **Avoid broad text selectors**: `page.locator('text=Red')` may match multiple elements
- **Use precise selectors**:
  - `page.getByText('Red', { exact: true })` for text with exact matching
  - `page.locator('p.text-xl.text-gray-800')` for class-based selection
  - `page.locator('a', { hasText: 'Button Text' })` for flexible text matching
- **Test multi-element scenarios carefully**: When the same text appears in multiple places, use element-specific selectors or nth() selector

### Page Load and Caching

- Use `page.goto('/', { waitUntil: 'networkidle' })` when database state matters
- SvelteKit's server-side load functions execute fresh on each page navigation
- Page is not cached between test runs (browser context resets)

### Test Independence

- Each test should verify its specific behavior without relying on test execution order
- Use the `db` fixture to guarantee clean state at test start
- Avoid implicit dependencies on previous test data

## Naming & Wording Mandates

- **Authentication**: Always use the wording **"sign-in"** and **"sign-out"** (including for button labels, headings, and URLs). Avoid using "login", "logout", "Log in", or "Log out".
- **Test Descriptions**: Use the present tense (e.g., "returns 200", "throws 401") and avoid repetitive wording like "should".

---

You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:

## Available MCP Tools:

### 1. list-sections

Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

### 2. get-documentation

Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user's task.

### 3. svelte-autofixer

Analyzes Svelte code and returns issues and suggestions.
You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

### 4. playground-link

Generates a Svelte Playground link with the provided code.
After completing the code, ask the user if they want a playground link. Only call this tool after user confirmation and NEVER if code was written to files in their project.
