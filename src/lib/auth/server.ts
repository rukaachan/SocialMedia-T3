import { headers } from "next/headers";
import { logAuthEvent } from "~/lib/auth/audit";
import { auth } from "~/lib/auth/better-auth";
import { clearRateLimit, rateLimit, RATE_LIMITS } from "~/lib/ratelimit";

type BetterAuthSession = Awaited<ReturnType<typeof auth.api.getSession>>;

export type AppSession = {
  expires: string;
  user: NonNullable<BetterAuthSession>["user"];
};

type AuthSessionCutoverState = {
  reason: "legacy_auth_cookie" | null;
  redirectTo: string | null;
  requiresReauthentication: boolean;
};

const FORCED_RELOGIN_REDIRECT = "/auth/sign-in?message=session_cutover";
const BETTER_AUTH_COOKIE_PREFIX = "better-auth.";
const LEGACY_AUTH_COOKIE_PREFIXES = ["authjs.", "next-auth."] as const;

function toAppSession(session: BetterAuthSession): AppSession | null {
  if (session == null) {
    return null;
  }

  return {
    expires: new Date(session.session.expiresAt).toISOString(),
    user: session.user,
  };
}

async function getRequestHeaders() {
  return headers();
}

function getCookieNames(cookieHeader: string | null) {
  if (cookieHeader == null || cookieHeader.length === 0) {
    return [];
  }

  return cookieHeader
    .split(";")
    .map((cookie) => cookie.trim().split("=")[0]?.trim())
    .filter(
      (cookieName): cookieName is string => typeof cookieName === "string" && cookieName.length > 0,
    );
}

function hasCookiePrefix(cookieNames: string[], prefix: string) {
  return cookieNames.some((cookieName) => cookieName.startsWith(prefix));
}

function getSignInOptions(options?: Record<string, unknown> | string) {
  if (typeof options === "string") {
    return null;
  }

  return options ?? null;
}

function getClientAddress(requestHeaders: Headers) {
  const forwardedFor = requestHeaders.get("x-forwarded-for");
  if (forwardedFor != null && forwardedFor.length > 0) {
    return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  }

  return requestHeaders.get("cf-connecting-ip") ?? requestHeaders.get("x-real-ip") ?? "unknown";
}

function normalizeEmail(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function getCredentialsRateLimitKey(email: string, requestHeaders: Headers) {
  return `sign-in:${email}:${getClientAddress(requestHeaders)}`;
}

function sanitizeCallbackURL(value: string | undefined) {
  if (value == null || value.length === 0) {
    return undefined;
  }

  if (value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }

  return undefined;
}

export async function getServerAuthSession() {
  return toAppSession(
    await auth.api.getSession({
      headers: await getRequestHeaders(),
    }),
  );
}

export async function getAuthSessionCutoverState(): Promise<AuthSessionCutoverState> {
  const requestHeaders = await getRequestHeaders();
  const cookieNames = getCookieNames(requestHeaders.get("cookie"));
  const hasBetterAuthCookie = hasCookiePrefix(cookieNames, BETTER_AUTH_COOKIE_PREFIX);
  const hasLegacyAuthCookie = LEGACY_AUTH_COOKIE_PREFIXES.some((prefix) =>
    hasCookiePrefix(cookieNames, prefix),
  );

  if (!hasBetterAuthCookie && hasLegacyAuthCookie) {
    return {
      reason: "legacy_auth_cookie",
      redirectTo: FORCED_RELOGIN_REDIRECT,
      requiresReauthentication: true,
    };
  }

  return {
    reason: null,
    redirectTo: null,
    requiresReauthentication: false,
  };
}

export async function getAuthRouteHandlers() {
  const routeModule = await import("~/app/api/auth/[...all]/route");

  return {
    GET: routeModule.GET,
    POST: routeModule.POST,
  };
}

export async function serverSignIn(
  provider: string,
  options?: Record<string, unknown> | string,
  authorizationParams?: string[][] | Record<string, string> | string | URLSearchParams,
) {
  const requestHeaders = await getRequestHeaders();
  const signInOptions = getSignInOptions(options);
  const callbackURL =
    typeof options === "string"
      ? options
      : typeof authorizationParams === "string"
        ? authorizationParams
        : ((signInOptions?.callbackURL as string | undefined) ??
          (signInOptions?.redirectTo as string | undefined));
  const safeCallbackURL = sanitizeCallbackURL(callbackURL);

  if (provider === "credentials") {
    const email = normalizeEmail(signInOptions?.email);
    const rateLimitKey = getCredentialsRateLimitKey(email, requestHeaders);

    logAuthEvent("sign_in_attempt", { email, provider });

    const rateLimitResult = await rateLimit({
      key: rateLimitKey,
      limit: RATE_LIMITS.SIGN_IN.limit,
      window: RATE_LIMITS.SIGN_IN.window,
    });

    if (!rateLimitResult.success) {
      logAuthEvent("sign_in_rate_limited", { email, provider, rateLimitKey });
      throw new Error("Too many sign-in attempts. Please try again later.");
    }

    try {
      const result = await auth.api.signInEmail({
        body: {
          callbackURL: safeCallbackURL,
          email,
          password: String(signInOptions?.password ?? ""),
        },
        headers: requestHeaders,
      });

      clearRateLimit(rateLimitKey);
      logAuthEvent("sign_in_success", { email, provider });
      return result;
    } catch (error) {
      logAuthEvent("sign_in_failure", {
        email,
        provider,
        message: error instanceof Error ? error.message : "unknown",
      });
      throw error;
    }
  }

  return auth.api.signInSocial({
    body: {
      callbackURL: safeCallbackURL,
      provider,
    },
    headers: requestHeaders,
  });
}

export async function serverSignOut(options?: Record<string, unknown>) {
  void options;

  logAuthEvent("sign_out", { action: "sign_out" });

  return auth.api.signOut({
    headers: await getRequestHeaders(),
  });
}
