import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const authenticatedRoutesDir = join(process.cwd(), "src/routes/(authenticated)");

function findServerFiles(directory: string): string[] {
	return readdirSync(directory).flatMap((entry) => {
		const path = join(directory, entry);
		const stats = statSync(path);

		if (stats.isDirectory()) {
			return findServerFiles(path);
		}

		return path.endsWith(".server.ts") ? [path] : [];
	});
}

describe("authenticated route guards", () => {
	it("wraps protected server loads and actions with authenticated helpers", () => {
		const serverFiles = findServerFiles(authenticatedRoutesDir);

		for (const file of serverFiles) {
			const source = readFileSync(file, "utf8");

			if (source.includes("export const load")) {
				expect(source, `${file} must export load via withAuthenticatedLoad`).toMatch(
					/export const load\s*=\s*withAuthenticatedLoad/s,
				);
			}

			if (source.includes("export const actions")) {
				expect(source, `${file} must export actions via withAuthenticatedActions`).toMatch(
					/export const actions\s*=\s*withAuthenticatedActions/s,
				);
			}
		}
	});
});
