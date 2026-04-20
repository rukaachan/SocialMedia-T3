// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getSessionMock = vi.fn();
const signInEmailMock = vi.fn();
const signInSocialMock = vi.fn();
const signOutMock = vi.fn();
const headersMock = vi.fn();
const rateLimitMock = vi.fn();
const clearRateLimitMock = vi.fn();
const logAuthEventMock = vi.fn();

vi.mock("next/headers", () => ({
  headers: headersMock,
}));

vi.mock("~/lib/auth/better-auth", () => ({
  auth: {
    api: {
      getSession: getSessionMock,
      signInEmail: signInEmailMock,
      signInSocial: signInSocialMock,
      signOut: signOutMock,
    },
  },
}));

vi.mock("~/lib/ratelimit", () => ({
  RATE_LIMITS: {
    SIGN_IN: { limit: 5, window: 60_000 },
  },
  rateLimit: rateLimitMock,
  clearRateLimit: clearRateLimitMock,
}));

vi.mock("~/lib/auth/audit", () => ({
  logAuthEvent: logAuthEventMock,
}));

describe("src/lib/auth/server.ts", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  beforeEach(() => {
    rateLimitMock.mockResolvedValue({
      success: true,
      remaining: 4,
      resetAt: Date.now() + 60_000,
    });
  });

  it("maps Better Auth sessions into the existing app session shape", async () => {
    const requestHeaders = new Headers({ cookie: "better-auth.session=token" });
    const expiresAt = new Date("2026-03-30T12:34:56.000Z");

    headersMock.mockResolvedValue(requestHeaders);
    getSessionMock.mockResolvedValue({
      session: {
        expiresAt,
      },
      user: {
        email: "ada@example.com",
        emailVerified: true,
        id: "user-1",
        image: "https://example.com/ada.png",
        name: "Ada",
      },
    });

    const { getServerAuthSession } = await import("~/lib/auth/server");

    await expect(getServerAuthSession()).resolves.toEqual({
      expires: expiresAt.toISOString(),
      user: {
        email: "ada@example.com",
        emailVerified: true,
        id: "user-1",
        image: "https://example.com/ada.png",
        name: "Ada",
      },
    });
    expect(getSessionMock).toHaveBeenCalledWith({ headers: requestHeaders });
  });

  it("routes credentials sign-in through Better Auth's email API", async () => {
    const requestHeaders = new Headers({ cookie: "better-auth.session=token" });

    headersMock.mockResolvedValue(requestHeaders);
    signInEmailMock.mockResolvedValue({ token: "session-token" });

    const { serverSignIn } = await import("~/lib/auth/server");

    await serverSignIn("credentials", {
      email: "ada@example.com",
      password: "hunter2",
      redirectTo: "/",
    });

    expect(signInEmailMock).toHaveBeenCalledWith({
      body: {
        callbackURL: "/",
        email: "ada@example.com",
        password: "hunter2",
      },
      headers: requestHeaders,
    });
  });

  it("rate limits credentials sign-in attempts before auth API call", async () => {
    const requestHeaders = new Headers({
      cookie: "better-auth.session=token",
      "x-forwarded-for": "10.0.0.2",
    });

    headersMock.mockResolvedValue(requestHeaders);
    rateLimitMock.mockResolvedValue({
      success: false,
      remaining: 0,
      resetAt: Date.now() + 15_000,
    });

    const { serverSignIn } = await import("~/lib/auth/server");

    await expect(
      serverSignIn("credentials", {
        email: "ada@example.com",
        password: "hunter2",
        redirectTo: "/",
      }),
    ).rejects.toThrow(/too many sign-in attempts/i);

    expect(signInEmailMock).not.toHaveBeenCalled();
    expect(rateLimitMock).toHaveBeenCalledTimes(1);
  });

  it("clears credentials sign-in limiter after successful auth", async () => {
    const requestHeaders = new Headers({
      cookie: "better-auth.session=token",
      "x-forwarded-for": "10.0.0.3",
    });

    headersMock.mockResolvedValue(requestHeaders);
    rateLimitMock.mockResolvedValue({
      success: true,
      remaining: 4,
      resetAt: Date.now() + 60_000,
    });
    signInEmailMock.mockResolvedValue({ token: "session-token" });

    const { serverSignIn } = await import("~/lib/auth/server");

    await serverSignIn("credentials", {
      email: "ada@example.com",
      password: "hunter2",
      redirectTo: "/",
    });

    expect(clearRateLimitMock).toHaveBeenCalledTimes(1);
    expect(logAuthEventMock).toHaveBeenCalled();
  });

  it("routes sign-out through Better Auth's sign-out API", async () => {
    const requestHeaders = new Headers({ cookie: "better-auth.session=token" });

    headersMock.mockResolvedValue(requestHeaders);
    signOutMock.mockResolvedValue({ success: true });

    const { serverSignOut } = await import("~/lib/auth/server");

    await serverSignOut();

    expect(signOutMock).toHaveBeenCalledWith({ headers: requestHeaders });
  });

  it("routes Discord social sign-in through Better Auth's social API", async () => {
    const requestHeaders = new Headers({ cookie: "better-auth.session=token" });

    headersMock.mockResolvedValue(requestHeaders);
    signInSocialMock.mockResolvedValue({ url: "/api/auth/sign-in/discord" });

    const { serverSignIn } = await import("~/lib/auth/server");

    await serverSignIn("discord", { redirectTo: "/settings/accounts" });

    expect(signInSocialMock).toHaveBeenCalledWith({
      body: {
        callbackURL: "/settings/accounts",
        provider: "discord",
      },
      headers: requestHeaders,
    });
  });

  it("routes Google social sign-in through Better Auth's social API", async () => {
    const requestHeaders = new Headers({ cookie: "better-auth.session=token" });

    headersMock.mockResolvedValue(requestHeaders);
    signInSocialMock.mockResolvedValue({ url: "/api/auth/sign-in/google" });

    const { serverSignIn } = await import("~/lib/auth/server");

    await serverSignIn("google", "/feed");

    expect(signInSocialMock).toHaveBeenCalledWith({
      body: {
        callbackURL: "/feed",
        provider: "google",
      },
      headers: requestHeaders,
    });
  });

  it("drops unsafe absolute callback URLs for social sign-in", async () => {
    const requestHeaders = new Headers({ cookie: "better-auth.session=token" });

    headersMock.mockResolvedValue(requestHeaders);
    signInSocialMock.mockResolvedValue({ url: "/api/auth/sign-in/google" });

    const { serverSignIn } = await import("~/lib/auth/server");

    await serverSignIn("google", "https://evil.example/phish");

    expect(signInSocialMock).toHaveBeenCalledWith({
      body: {
        callbackURL: undefined,
        provider: "google",
      },
      headers: requestHeaders,
    });
  });

  it("flags legacy Auth.js cookies as requiring a forced re-login", async () => {
    headersMock.mockResolvedValue(new Headers({ cookie: "authjs.session-token=legacy-jwt" }));
    getSessionMock.mockResolvedValue(null);

    const { getAuthSessionCutoverState } = await import("~/lib/auth/server");

    await expect(getAuthSessionCutoverState()).resolves.toEqual({
      reason: "legacy_auth_cookie",
      redirectTo: "/auth/sign-in?message=session_cutover",
      requiresReauthentication: true,
    });
  });

  it("does not force a re-login when a Better Auth session cookie is present", async () => {
    headersMock.mockResolvedValue(
      new Headers({
        cookie: "authjs.session-token=legacy-jwt; better-auth.session=token",
      }),
    );
    getSessionMock.mockResolvedValue(null);

    const { getAuthSessionCutoverState } = await import("~/lib/auth/server");

    await expect(getAuthSessionCutoverState()).resolves.toEqual({
      reason: null,
      redirectTo: null,
      requiresReauthentication: false,
    });
  });
});
