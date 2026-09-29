import { consola } from "consola";
import { vi } from "vitest";

// Silence consola during tests
consola.level = -1;

// Unit tests get a fixed, empty environment instead of whatever the shell or
// `infisical run` provides. A spec that needs values mocks the module itself.
vi.mock("$env/dynamic/private", () => ({ env: {} }));
