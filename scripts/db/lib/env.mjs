// @ts-nocheck

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function parseEnvFile(content) {
  for (const line of content.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = stripQuotes(trimmed.slice(separatorIndex + 1).trim());

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

export function loadLocalEnvFiles(cwd = process.cwd()) {
  for (const fileName of [".env", ".env.local"]) {
    const filePath = path.resolve(cwd, fileName);
    if (!existsSync(filePath)) continue;
    parseEnvFile(readFileSync(filePath, "utf8"));
  }
}
