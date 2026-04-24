import { spawnSync } from "node:child_process";

const GITHUB_REPOSITORY = "tactilenews/dialogbank-app";

const DEFAULT_SECRET_NAMES = [
	"DATABASE_URL",
	"ELEVENLABS_AGENT_ID",
	"ELEVENLABS_AGENT_PARENT_BRANCH_ID",
	"ELEVENLABS_API_KEY",
	"ELEVENLABS_WORKFLOW_NODE_ID",
	"NEON_API_KEY",
	"NEON_PROJECT_ID",
	"PARENT_BRANCH_ID",
] as const;

function parseSecretNames(rawValue: string | undefined): string[] {
	if (!rawValue) {
		return [...DEFAULT_SECRET_NAMES];
	}

	return rawValue
		.split(",")
		.map((name) => name.trim())
		.filter((name, index, names) => name.length > 0 && names.indexOf(name) === index);
}

function getOptionalEnv(name: string): string | undefined {
	const value = process.env[name];

	if (!value) {
		return undefined;
	}

	return value;
}

function syncSecret(repo: string, name: string, value: string): void {
	const result = spawnSync(
		"gh",
		["secret", "set", "--app", "dependabot", name, "--repo", repo, "--body", value],
		{
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		},
	);

	if (result.error) {
		throw result.error;
	}

	if (result.status !== 0) {
		const stderr = result.stderr.trim();
		throw new Error(stderr || `Failed to sync ${name} to ${repo}`);
	}
}

function main(): void {
	const secretNames = parseSecretNames(getOptionalEnv("DEPENDABOT_SECRET_NAMES"));
	const missingSecretNames = secretNames.filter((name) => !process.env[name]);

	if (missingSecretNames.length > 0) {
		throw new Error(`Missing secret values in the environment: ${missingSecretNames.join(", ")}`);
	}

	for (const name of secretNames) {
		const value = process.env[name];

		if (!value) {
			throw new Error(`Missing secret value for ${name}`);
		}

		console.log(`Syncing ${name} to Dependabot secrets for ${GITHUB_REPOSITORY}`);
		syncSecret(GITHUB_REPOSITORY, name, value);
	}

	console.log(`Synced ${secretNames.length} Dependabot secrets to ${GITHUB_REPOSITORY}`);
}

try {
	main();
} catch (error) {
	const message = error instanceof Error ? error.message : "Unknown error";
	console.error(message);
	process.exitCode = 1;
}
