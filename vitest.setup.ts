import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

vi.mock("next/server", () => ({
  NextRequest: class NextRequest {},
  NextResponse: { json: vi.fn(), next: vi.fn(), redirect: vi.fn() },
  userAgent: vi.fn(),
}));

vi.mock("next/server.js", () => ({
  NextRequest: class NextRequest {},
  NextResponse: { json: vi.fn(), next: vi.fn(), redirect: vi.fn() },
  userAgent: vi.fn(),
}));

const { loadEnvConfig } = require("@next/env") as {
  loadEnvConfig: (dir: string) => void;
};

loadEnvConfig(process.cwd());

process.env.BETTER_AUTH_SECRET ??= "vitest-auth-secret";
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
process.env.DISCORD_CLIENT_ID ??= "vitest-discord-id";
process.env.DISCORD_CLIENT_SECRET ??= "vitest-discord-secret";
process.env.GOOGLE_CLIENT_ID ??= "vitest-google-id";
process.env.GOOGLE_CLIENT_SECRET ??= "vitest-google-secret";
process.env.TURSO_DATABASE_URL ??= "file:./src/db/local.db";

afterEach(() => {
  cleanup();
});
