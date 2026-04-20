import { env } from "~/env.mjs";

type PlatformEnvSource = {
  APP_BASE_URL?: string;
  BETTER_AUTH_TRUSTED_ORIGINS?: string;
  BETTER_AUTH_URL?: string;
  BETTER_AUTH_SECRET?: string;
  DATABASE_URL?: string;
  DISCORD_CLIENT_ID?: string;
  DISCORD_CLIENT_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  TURSO_AUTH_TOKEN?: string;
  TURSO_DATABASE_URL?: string;
};

function readFirstDefined(...values: Array<string | undefined>) {
  return values.find((value) => value != null && value.length > 0);
}

function requireEnv(name: string, value: string | undefined) {
  if (value == null || value.length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function readTrustedOrigins(
  value: string | undefined,
  baseUrl: string | undefined
) {
  const origins = new Set<string>();

  if (baseUrl != null && baseUrl.length > 0) {
    origins.add(baseUrl);
  }

  for (const candidate of value?.split(",") ?? []) {
    const normalized = candidate.trim();

    if (normalized.length > 0) {
      origins.add(normalized);
    }
  }

  return [...origins];
}

export function readPlatformEnv(source: PlatformEnvSource) {
  const baseUrl = readFirstDefined(source.APP_BASE_URL, source.BETTER_AUTH_URL);

  return {
    app: {
      baseUrl,
    },
    auth: {
      secret: requireEnv("BETTER_AUTH_SECRET", source.BETTER_AUTH_SECRET),
      trustedOrigins: readTrustedOrigins(
        source.BETTER_AUTH_TRUSTED_ORIGINS,
        baseUrl
      ),
      discord: {
        clientId: source.DISCORD_CLIENT_ID ?? null,
        clientSecret: source.DISCORD_CLIENT_SECRET ?? null,
      },
      google: {
        clientId: source.GOOGLE_CLIENT_ID ?? null,
        clientSecret: source.GOOGLE_CLIENT_SECRET ?? null,
      },
    },
    database: {
      url: requireEnv(
        "TURSO_DATABASE_URL | DATABASE_URL",
        readFirstDefined(source.TURSO_DATABASE_URL, source.DATABASE_URL)
      ),
      authToken: source.TURSO_AUTH_TOKEN,
    },
  } as const;
}

export function getPlatformEnv() {
  return readPlatformEnv(env);
}
