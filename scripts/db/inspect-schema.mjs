import { existsSync } from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { loadLocalEnvFiles } from "./lib/env.mjs";

loadLocalEnvFiles();

const configuredUrl =
  process.env.TURSO_DATABASE_URL ??
  process.env.DRIZZLE_TURSO_DATABASE_URL ??
  process.env.DATABASE_URL;
const url = configuredUrl ?? "file:./src/db/local.db";
const isLocalFile = url.startsWith("file:");
const localPath = isLocalFile ? path.resolve(process.cwd(), url.slice("file:".length)) : null;

if (localPath != null && !existsSync(localPath)) {
  console.log(
    JSON.stringify(
      {
        inspected: false,
        reason: "local_database_not_found",
        path: localPath,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const client = createClient({
  url,
  ...(process.env.TURSO_AUTH_TOKEN != null &&
  (url.startsWith("libsql://") || url.startsWith("https://"))
    ? { authToken: process.env.TURSO_AUTH_TOKEN }
    : {}),
});

/** @param {string} identifier */
function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

try {
  const tables = await client.execute(
    "SELECT name, type, sql FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  const indexes = await client.execute(
    "SELECT name, tbl_name, sql FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%' ORDER BY tbl_name, name",
  );
  const report = [];

  for (const table of tables.rows) {
    const tableName = String(table.name);
    const columns = await client.execute(`PRAGMA table_info(${quoteIdentifier(tableName)})`);
    const foreignKeys = await client.execute(
      `PRAGMA foreign_key_list(${quoteIdentifier(tableName)})`,
    );

    report.push({
      name: tableName,
      type: table.type,
      columns: columns.rows,
      foreignKeys: foreignKeys.rows,
      sql: table.sql,
      indexes: indexes.rows.filter((index) => index.tbl_name === tableName),
    });
  }

  console.log(
    JSON.stringify(
      {
        inspected: true,
        source: isLocalFile ? localPath : "configured remote database",
        tables: report,
      },
      null,
      2,
    ),
  );
} finally {
  client.close();
}
