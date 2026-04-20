// @ts-nocheck

import { readFile } from "node:fs/promises";
import { DEFAULT_MIGRATION_SQL_PATH, TARGET_CLEAR_ORDER } from "./constants.mjs";
import { isAlreadyExistsError, quoteIdentifier, splitSqlStatements } from "./helpers.mjs";

export async function ensureTursoSchema(client, migrationSqlPath = DEFAULT_MIGRATION_SQL_PATH) {
  const sqlText = await readFile(migrationSqlPath, "utf8");
  await client.execute("PRAGMA foreign_keys = ON;");

  for (const statement of splitSqlStatements(sqlText)) {
    try {
      await client.execute(statement);
    } catch (error) {
      if (!isAlreadyExistsError(error)) {
        throw error;
      }
    }
  }
}

export async function clearTursoData(client) {
  await client.execute("PRAGMA foreign_keys = OFF;");

  for (const tableName of TARGET_CLEAR_ORDER) {
    await client.execute(`DELETE FROM ${quoteIdentifier(tableName)};`);
  }

  await client.execute("PRAGMA foreign_keys = ON;");
}
