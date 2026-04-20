// @vitest-environment node

import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/lib/auth/server", () => ({
  getServerAuthSession: vi.fn(),
}));

vi.mock("~/server/auth/linking", () => ({
  unlinkProvider: vi.fn(),
}));

vi.mock("~/lib/ratelimit", () => ({
  RATE_LIMITS: {
    UNLINK_PROVIDER: { limit: 10, window: 60_000 },
  },
  rateLimit: vi.fn(),
}));

import { POST } from "~/app/api/auth/unlink/route";
import { getServerAuthSession } from "~/lib/auth/server";
import { rateLimit } from "~/lib/ratelimit";
import { unlinkProvider } from "~/server/auth/linking";

describe("src/app/api/auth/unlink/route.ts", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("rejects cross-site or origin-less requests", async () => {
    vi.mocked(getServerAuthSession).mockResolvedValue({
      expires: new Date(Date.now() + 60_000).toISOString(),
      user: {
        id: "user-1",
        createdAt: new Date(0),
        updatedAt: new Date(0),
        email: "user@example.com",
        emailVerified: false,
        image: null,
        name: "user-1",
      },
    });

    const request = new Request("http://localhost/api/auth/unlink", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        provider: "google",
        providerAccountId: "provider-account-1",
      }),
    });

    await POST(request as never);

    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: "Invalid request origin" },
      { status: 403 },
    );
    expect(rateLimit).not.toHaveBeenCalled();
    expect(unlinkProvider).not.toHaveBeenCalled();
  });

  it("returns 429 when unlink is rate limited", async () => {
    vi.mocked(getServerAuthSession).mockResolvedValue({
      expires: new Date(Date.now() + 60_000).toISOString(),
      user: {
        id: "user-2",
        createdAt: new Date(0),
        updatedAt: new Date(0),
        email: "user2@example.com",
        emailVerified: false,
        image: null,
        name: "user-2",
      },
    });
    vi.mocked(rateLimit).mockResolvedValue({
      success: false,
      remaining: 0,
      resetAt: Date.now() + 10_000,
    });

    await POST(
      new Request("http://localhost/api/auth/unlink", {
        method: "POST",
        headers: {
          origin: "http://localhost",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          provider: "google",
          providerAccountId: "provider-account-2",
        }),
      }) as never,
    );

    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: expect.stringMatching(/Too many unlink attempts/i) },
      { status: 429 },
    );
    expect(unlinkProvider).not.toHaveBeenCalled();
  });

  it("unlinks provider on same-origin, authenticated, non-limited requests", async () => {
    vi.mocked(getServerAuthSession).mockResolvedValue({
      expires: new Date(Date.now() + 60_000).toISOString(),
      user: {
        id: "user-3",
        createdAt: new Date(0),
        updatedAt: new Date(0),
        email: "user3@example.com",
        emailVerified: false,
        image: null,
        name: "user-3",
      },
    });
    vi.mocked(rateLimit).mockResolvedValue({
      success: true,
      remaining: 9,
      resetAt: Date.now() + 60_000,
    });
    vi.mocked(unlinkProvider).mockResolvedValue(undefined);

    await POST(
      new Request("http://localhost/api/auth/unlink", {
        method: "POST",
        headers: {
          origin: "http://localhost",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          provider: "google",
          providerAccountId: "provider-account-3",
        }),
      }) as never,
    );

    expect(NextResponse.json).toHaveBeenCalledWith({ success: true });
    expect(rateLimit).toHaveBeenCalledWith({
      key: "unlink-provider-user-3",
      limit: 10,
      window: 60_000,
    });
    expect(unlinkProvider).toHaveBeenCalledWith({
      userId: "user-3",
      provider: "google",
      providerAccountId: "provider-account-3",
    });
  });
});
