import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";

const args = process.argv.slice(2);

if (args.length === 0) {
  throw new Error("Usage: node scripts/cloudflare/opennext-cloudflare.mjs <command> [...args]");
}

const cliArgs = ["opennextjs-cloudflare", ...args];

const envWhitelist = [
  "APP_BASE_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "BETTER_AUTH_TRUSTED_ORIGINS",
  "DISCORD_CLIENT_ID",
  "DISCORD_CLIENT_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "AUTH_DISCORD_ID",
  "AUTH_DISCORD_SECRET",
  "AUTH_GOOGLE_ID",
  "AUTH_GOOGLE_SECRET",
  "AUTH_SECRET",
  "AUTH_TRUST_HOST",
  "AUTH_URL",
  "CI",
  "DATABASE_URL",
  "DRIZZLE_TURSO_AUTH_TOKEN",
  "DRIZZLE_TURSO_DATABASE_URL",
  "NEXTJS_ENV",
  "NODE_ENV",
  "SKIP_ENV_VALIDATION",
  "TURSO_AUTH_TOKEN",
  "TURSO_DATABASE_URL",
];

/** @returns {NodeJS.ProcessEnv} */
function getChildEnv() {
  /** @type {Record<string, string | undefined>} */
  const childEnv = { ...process.env };

  // Next's build-time page analysis imports the database/auth modules even
  // though the real values are supplied by Wrangler at Worker runtime.
  // Keep these non-secret placeholders scoped to OpenNext builds only.
  if (args[0] === "build") {
    if (childEnv.TURSO_DATABASE_URL == null) {
      childEnv.TURSO_DATABASE_URL = "file:/tmp/tweeva-build.db";
    }

    if (childEnv.BETTER_AUTH_SECRET == null) {
      childEnv.BETTER_AUTH_SECRET = "build-only-placeholder-build-only-placeholder";
    }

    if (childEnv.APP_BASE_URL == null) {
      childEnv.APP_BASE_URL = "http://127.0.0.1:8787";
    }

    if (childEnv.BETTER_AUTH_TRUSTED_ORIGINS == null) {
      childEnv.BETTER_AUTH_TRUSTED_ORIGINS = "http://127.0.0.1:8787";
    }
  }

  return /** @type {NodeJS.ProcessEnv} */ (childEnv);
}

/** @param {string} value */
function shellEscape(value) {
  return `'${String(value).replace(/'/g, `'"'"'`)}'`;
}

/** @param {string} windowsPath */
function toWslPath(windowsPath) {
  const normalized = path.resolve(windowsPath).replace(/\\/g, "/");
  const driveMatch = normalized.match(/^([A-Za-z]):\/(.*)$/);

  if (!driveMatch) {
    throw new Error(`Unable to convert path to WSL format: ${windowsPath}`);
  }

  const [, driveLetter = "", remainder = ""] = driveMatch;

  return `/mnt/${driveLetter.toLowerCase()}/${remainder}`;
}

/**
 * @param {string} command
 * @param {string[]} commandArgs
 * @param {import("node:child_process").SpawnOptions} [options]
 */
function run(command, commandArgs, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      stdio: "inherit",
      shell: false,
      ...options,
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal != null) {
        reject(new Error(`${command} exited with signal ${signal}`));
        return;
      }

      resolve(code ?? 0);
    });
  });
}

async function main() {
  const childEnv = getChildEnv();

  if (process.platform !== "win32") {
    const code = await run("pnpm", ["exec", ...cliArgs], {
      cwd: process.cwd(),
      env: childEnv,
    });
    process.exit(code);
  }

  const exportedEnv = envWhitelist
    .filter((name) => childEnv[name] != null && childEnv[name] !== "")
    .map((name) => `export ${name}=${shellEscape(childEnv[name] ?? "")}`)
    .join(" && ");

  const repoPath = toWslPath(process.cwd());
  const wslCommand = [
    exportedEnv,
    `cd ${shellEscape(repoPath)}`,
    `pnpm exec ${cliArgs.map(shellEscape).join(" ")}`,
  ]
    .filter(Boolean)
    .join(" && ");

  const code = await run("wsl.exe", ["bash", "-lc", wslCommand], {
    cwd: process.cwd(),
    env: process.env,
  });

  process.exit(code);
}

await main();
