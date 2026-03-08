## Project Configuration

- **Language**: TypeScript
- **Package Manager**: pnpm
- **Add-ons**: prettier, eslint, vitest, playwright, tailwindcss, sveltekit-adapter, devtools-json, drizzle, better-auth, mdsvex, storybook, mcp

## Secrets & Environment Variables

- **Infisical**: All commands that require secrets (including `dev`, `build`, `preview`, `test`, `test:e2e`, and `db:*`) must be run using Infisical to provide environment variables.
  - **Usage**: `infisical run --env [env] -- [command]`
  - **Testing**: All test-related scripts (e.g., `test`, `test:e2e`, `vitest`) **must** be run with `--env test`.
  - Example: `infisical run --env dev -- pnpm dev`
  - Example: `infisical run --env test -- pnpm test:e2e`

## Documentation

- [ElevenLabs API Reference](https://elevenlabs.io/docs/api-reference/introduction)

## Testing Mandates

- **E2E Tests**: All E2E tests must be located in the top-level `e2e/` directory. They should be named with `.test.ts` or `.spec.ts` extensions.
- **Integration Tests**: Every component must have a co-located integration test file ending in `.spec.ts` (e.g., `src/lib/components/MyComponent.spec.ts`). For route pages (`+page.svelte`), an integration test should be used to test component logic in isolation.

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
