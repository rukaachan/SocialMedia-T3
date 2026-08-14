// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/lib/auth/server", () => ({
  getServerAuthSession: vi.fn(),
}));

vi.mock("~/lib/ratelimit", () => ({
  RATE_LIMITS: {
    UPLOAD_MEDIA: { limit: 20, window: 60_000 },
  },
  rateLimit: vi.fn(),
}));

vi.mock("~/server/platform/media", () => ({
  MAX_ALT_TEXT_LENGTH: 200,
  MAX_MEDIA_BYTES: 5 * 1024 * 1024,
  MEDIA_PURPOSES: ["avatar", "post"],
  MediaValidationError: class MediaValidationError extends Error {
    status = 400;
  },
  createMediaService: vi.fn(),
}));

import { POST } from "~/app/api/media/upload/route";
import { getServerAuthSession } from "~/lib/auth/server";
import { rateLimit } from "~/lib/ratelimit";
import { createMediaService } from "~/server/platform/media";

const session = {
  expires: new Date(Date.now() + 60_000).toISOString(),
  user: {
    id: "media-route-user",
    createdAt: new Date(0),
    updatedAt: new Date(0),
    email: "media@example.com",
    emailVerified: false,
    image: null,
    name: "Media User",
  },
};

function request(body?: FormData, headers?: HeadersInit) {
  return new Request("http://localhost/api/media/upload", {
    method: "POST",
    headers: { origin: "http://localhost", ...headers },
    body,
  });
}

describe("media upload route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getServerAuthSession).mockResolvedValue(session);
    vi.mocked(rateLimit).mockResolvedValue({
      success: true,
      remaining: 19,
      resetAt: Date.now() + 60_000,
    });
  });

  it("rejects missing or cross-origin mutation requests before storage access", async () => {
    const noOriginResponse = await POST(
      new Request("http://localhost/api/media/upload", {
        method: "POST",
        body: new FormData(),
      }),
    );
    expect(noOriginResponse.status).toBe(403);
    expect(rateLimit).not.toHaveBeenCalled();
    expect(createMediaService).not.toHaveBeenCalled();
  });

  it("requires an authenticated session", async () => {
    vi.mocked(getServerAuthSession).mockResolvedValue(null);
    const response = await POST(request(new FormData()));
    expect(response.status).toBe(401);
    expect(rateLimit).not.toHaveBeenCalled();
  });

  it("validates the multipart fields and delegates a same-origin upload", async () => {
    const upload = vi.fn().mockResolvedValue({
      id: "asset-1",
      objectKey: "media/asset-1.png",
    });
    vi.mocked(createMediaService).mockResolvedValue({ upload } as never);
    const form = new FormData();
    form.set("purpose", "post");
    form.set("altText", "A test image");
    form.set("file", new File([new Uint8Array([1, 2, 3])], "test.png", { type: "image/png" }));

    const response = await POST(request(form));
    expect(response.status).toBe(201);
    expect(upload).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: session.user.id,
        purpose: "post",
        altText: "A test image",
        file: expect.any(File),
      }),
    );
  });

  it("returns a bounded rate-limit response", async () => {
    vi.mocked(rateLimit).mockResolvedValue({
      success: false,
      remaining: 0,
      resetAt: Date.now() + 10_000,
    });
    const response = await POST(request(new FormData()));
    expect(response.status).toBe(429);
    expect(createMediaService).not.toHaveBeenCalled();
  });
});
