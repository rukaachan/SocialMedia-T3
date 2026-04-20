const LOCALHOST_PORT = process.env.PORT ?? "3000";

function normalizeBaseUrl(value: string | undefined) {
  if (value == null || value.length === 0) return null;
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function getConfiguredBaseUrl() {
  return normalizeBaseUrl(
    process.env.APP_BASE_URL ?? process.env.BETTER_AUTH_URL
  );
}

export function getBaseUrl() {
  if (typeof window !== "undefined") return "";

  return getConfiguredBaseUrl() ?? `http://localhost:${LOCALHOST_PORT}`;
}
