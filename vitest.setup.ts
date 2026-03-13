import { consola } from "consola";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll } from "vitest";

// Silence consola during tests
consola.level = -1;

beforeAll(async () => {
	if (process.env.VITEST !== "true" && process.env.VITEST !== "1") return;
	const { db } = await import("$lib/server/db");
	await migrate(db, { migrationsFolder: "drizzle" });
});
