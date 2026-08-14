// @vitest-environment node

import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { describe, expect, it } from "vitest";
import { ensureTursoSchema, splitSqlStatements } from "../../../scripts/db/lib/cutover.mjs";

const featureMigrationPath = path.resolve(
  process.cwd(),
  "src/db/migrations/0001_powerful_scrambler.sql",
);

describe("feature migration compatibility", () => {
  it("adds feature columns without losing existing tweet data", async () => {
    const client = createClient({ url: ":memory:" });
    try {
      await ensureTursoSchema(client);
      await client.execute(
        `INSERT INTO "user" ("id", "name", "email", "createdAt", "updatedAt") VALUES ('legacy-user', 'Legacy', 'legacy@example.com', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
      );
      await client.execute(
        `INSERT INTO "tweet" ("id", "userId", "content", "createdAt") VALUES ('legacy-tweet', 'legacy-user', 'kept content', '2026-01-02T00:00:00.000Z')`,
      );

      const migration = readFileSync(featureMigrationPath, "utf8");
      for (const statement of splitSqlStatements(migration)) {
        await client.execute(statement);
      }

      const row = await client.execute(
        `SELECT "content", "createdAt", "updatedAt" FROM "tweet" WHERE "id" = 'legacy-tweet'`,
      );
      expect(row.rows[0]).toMatchObject({
        content: "kept content",
        createdAt: "2026-01-02T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      });

      const tables = await client.execute(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('mediaAsset', 'bookmark') ORDER BY name`,
      );
      expect(tables.rows.map((table) => table.name)).toEqual(["bookmark", "mediaAsset"]);
    } finally {
      client.close();
    }
  });
});
