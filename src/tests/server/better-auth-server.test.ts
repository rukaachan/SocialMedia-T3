// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

const betterAuthMock = vi.fn();
const drizzleAdapterMock = vi.fn();
const toNextJsHandlerMock = vi.fn();

vi.mock("better-auth", () => ({
  betterAuth: betterAuthMock,
}));

vi.mock("@better-auth/drizzle-adapter", () => ({
  drizzleAdapter: drizzleAdapterMock,
}));

vi.mock("better-auth/next-js", () => ({
  toNextJsHandler: toNextJsHandlerMock,
}));

vi.mock("~/db", () => ({
  db: { kind: "db" },
}));

vi.mock("~/db/better-auth-schema", () => ({
  betterAuthSchema: { schema: "better-auth" },
}));

vi.mock("~/server/platform/env", () => ({
  getPlatformEnv: () => ({
    app: { baseUrl: "https://tweeva.example.com" },
    auth: {
      discord: { clientId: "discord-id", clientSecret: "discord-secret" },
      google: { clientId: "google-id", clientSecret: "google-secret" },
      secret: "super-secret",
      trustedOrigins: ["https://tweeva.example.com"],
      trustHost: true,
    },
    database: {
      authToken: undefined,
      url: "file:./src/db/local.db",
    },
  }),
}));

describe("Better Auth server boundary", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("configures the Better Auth server with drizzle, providers, credentials, and explicit linking rules", async () => {
    const authInstance = { api: { getSession: vi.fn() }, handler: vi.fn() };
    drizzleAdapterMock.mockReturnValue({ adapter: true });
    betterAuthMock.mockReturnValue(authInstance);

    const { auth } = await import("~/lib/auth/better-auth");

    expect(auth).toBe(authInstance);
    expect(drizzleAdapterMock).toHaveBeenCalledWith(
      { kind: "db" },
      {
        provider: "sqlite",
        schema: { schema: "better-auth" },
      }
    );
    expect(betterAuthMock).toHaveBeenCalledTimes(1);

    const config = betterAuthMock.mock.calls[0]?.[0];

    expect(config).toMatchObject({
      account: {
        accountLinking: {
          allowDifferentEmails: false,
          allowUnlinkingAll: false,
          disableImplicitLinking: true,
          enabled: true,
          trustedProviders: [],
        },
      },
      baseURL: "https://tweeva.example.com",
      secret: "super-secret",
      trustedOrigins: ["https://tweeva.example.com"],
      emailAndPassword: {
        enabled: true,
        maxPasswordLength: 128,
        minPasswordLength: 12,
        requireEmailVerification: true,
      },
      socialProviders: {
        discord: {
          clientId: "discord-id",
          clientSecret: "discord-secret",
        },
        google: {
          clientId: "google-id",
          clientSecret: "google-secret",
        },
      },
    });

    expect(config.emailAndPassword.password.hash).toBeTypeOf("function");
    expect(config.emailAndPassword.password.verify).toBeTypeOf("function");
  });

  it("configures credentials lifecycle callbacks for verification and password reset flows", async () => {
    const authInstance = { api: { getSession: vi.fn() }, handler: vi.fn() };
    drizzleAdapterMock.mockReturnValue({ adapter: true });
    betterAuthMock.mockReturnValue(authInstance);

    await import("~/lib/auth/better-auth");

    const config = betterAuthMock.mock.calls[0]?.[0];

    expect(config.emailAndPassword).toMatchObject({
      enabled: true,
      maxPasswordLength: 128,
      minPasswordLength: 12,
      requireEmailVerification: true,
      resetPasswordTokenExpiresIn: 3600,
    });
    expect(config.emailAndPassword.sendResetPassword).toBeTypeOf("function");
    expect(config.emailVerification).toMatchObject({
      sendOnSignUp: true,
    });
    expect(config.emailVerification.sendVerificationEmail).toBeTypeOf(
      "function"
    );
  });

  it("exports the canonical App Router GET and POST handlers", async () => {
    const authInstance = { api: {}, handler: vi.fn() };
    const GET = vi.fn();
    const POST = vi.fn();

    drizzleAdapterMock.mockReturnValue({ adapter: true });
    betterAuthMock.mockReturnValue(authInstance);
    toNextJsHandlerMock.mockReturnValue({ GET, POST });

    const routeModule = await import("~/app/api/auth/[...all]/route");

    expect(toNextJsHandlerMock).toHaveBeenCalledWith(authInstance);
    expect(routeModule.GET).toBe(GET);
    expect(routeModule.POST).toBe(POST);
  });
});
