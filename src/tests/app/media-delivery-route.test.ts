// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/db", () => ({
  db: {
    query: {
      mediaAsset: {
        findFirst: vi.fn(),
      },
    },
  },
  schemaReady: Promise.resolve(),
}));

vi.mock("~/server/platform/media", () => ({
  resolveMediaBucket: vi.fn(),
}));

import { GET } from "~/app/api/media/[...key]/route";
import { db } from "~/db";
import { resolveMediaBucket } from "~/server/platform/media";

const findFirst = db.query.mediaAsset.findFirst;

describe("media delivery route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("does not query storage for unsafe object keys", async () => {
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ key: ["..", "secrets.txt"] }),
    });

    expect(response.status).toBe(404);
    expect(findFirst).not.toHaveBeenCalled();
    expect(resolveMediaBucket).not.toHaveBeenCalled();
  });

  it("does not serve missing or deleted metadata", async () => {
    vi.mocked(findFirst).mockResolvedValue(undefined);
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ key: ["media", "missing.png"] }),
    });

    expect(response.status).toBe(404);
    expect(resolveMediaBucket).not.toHaveBeenCalled();
  });

  it("serves attached media with safe immutable response headers", async () => {
    vi.mocked(findFirst).mockResolvedValue({
      objectKey: "media/asset-1.png",
      status: "attached",
      deletedAt: null,
    } as never);
    const bucket = {
      get: vi.fn().mockResolvedValue({
        body: new Uint8Array([1, 2, 3]),
        size: 3,
        httpEtag: '"asset-1"',
        httpMetadata: { contentType: "image/png" },
      }),
    };
    vi.mocked(resolveMediaBucket).mockResolvedValue(bucket as never);

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ key: ["media", "asset-1.png"] }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("content-disposition")).toBe("inline");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(bucket.get).toHaveBeenCalledWith("media/asset-1.png");
  });
});
