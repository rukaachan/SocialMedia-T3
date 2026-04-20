import { defineConfig } from "drizzle-kit";

const url =
  process.env.DRIZZLE_TURSO_DATABASE_URL ??
  process.env.TURSO_DATABASE_URL ??
  "file:./src/db/local.db";
const authToken =
  process.env.DRIZZLE_TURSO_AUTH_TOKEN ?? process.env.TURSO_AUTH_TOKEN;

export default defineConfig({
  dialect: "turso",
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dbCredentials: {
    url,
    ...(authToken ? { authToken } : {}),
  },
  verbose: true,
  strict: true,
});
