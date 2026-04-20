// @ts-nocheck

export function iso(value) {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

export function quoteIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

export function splitSqlStatements(sqlText) {
  return sqlText
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

export function isAlreadyExistsError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return /already exists/i.test(message);
}

export function chunk(values, size = 100) {
  const result = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

export function collectDuplicates(values) {
  const seen = new Set();
  let duplicates = 0;

  for (const value of values) {
    if (seen.has(value)) {
      duplicates += 1;
      continue;
    }

    seen.add(value);
  }

  return duplicates;
}

export function compareMetrics(keys, source, target) {
  const mismatches = [];

  for (const key of keys) {
    if ((source[key] ?? 0) !== (target[key] ?? 0)) {
      mismatches.push(key);
    }
  }

  return mismatches;
}

export function buildTable(lines) {
  return lines.join("\n");
}

export async function selectAll(client, sql) {
  const result = await client.execute(sql);
  return result.rows.map((row) => Object.fromEntries(Object.entries(row)));
}

export async function insertRows(client, tableName, rows) {
  if (rows.length === 0) return;

  const columns = Object.keys(rows[0]);
  const sql = `INSERT INTO ${quoteIdentifier(tableName)} (${columns
    .map(quoteIdentifier)
    .join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`;

  for (const batch of chunk(rows, 100)) {
    await client.batch(
      batch.map((row) => ({
        sql,
        args: columns.map((column) => row[column] ?? null),
      })),
      "write",
    );
  }
}
