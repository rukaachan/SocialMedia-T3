// @vitest-environment node

import { afterEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, schemaReady } from "~/db";
import { mediaAsset, user } from "~/db/schema";
import {
  createMediaService,
  detectImage,
  MAX_MEDIA_BYTES,
  type MediaBucket,
  validateImageUpload,
} from "~/server/platform/media";

function pngBytes(width = 1, height = 1) {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width, false);
  view.setUint32(20, height, false);
  return bytes;
}

function uploadFile(bytes: Uint8Array, type = "image/png") {
  return {
    size: bytes.byteLength,
    type,
    arrayBuffer: async () => {
      const copy = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(copy).set(bytes);
      return copy;
    },
  };
}

function createFakeBucket() {
  const objects = new Map<string, Uint8Array>();
  const bucket: MediaBucket = {
    async put(key, value) {
      if (value instanceof ArrayBuffer) {
        objects.set(key, new Uint8Array(value));
        return;
      }

      if (ArrayBuffer.isView(value)) {
        objects.set(key, new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
        return;
      }

      const chunks: Uint8Array[] = [];
      const reader = value.getReader();
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        chunks.push(next.value);
      }
      objects.set(
        key,
        chunks.reduce((all, chunk) => {
          const next = new Uint8Array(all.length + chunk.length);
          next.set(all);
          next.set(chunk, all.length);
          return next;
        }, new Uint8Array()),
      );
    },
    async get() {
      return null;
    },
    async delete(key) {
      objects.delete(key);
    },
  };

  return { bucket, objects };
}

describe("media validation and storage service", () => {
  const createdUserIds: string[] = [];

  afterEach(async () => {
    for (const userId of createdUserIds.splice(0)) {
      await db.delete(user).where(eq(user.id, userId));
    }
  });

  it("detects PNG signatures and dimensions instead of trusting MIME alone", () => {
    const result = detectImage(pngBytes(320, 180));

    expect(result).toMatchObject({
      mimeType: "image/png",
      extension: "png",
      dimensions: { width: 320, height: 180 },
    });
    expect(detectImage(new Uint8Array([1, 2, 3]))).toBeNull();
  });

  it("rejects files over the server byte limit", () => {
    expect(() =>
      validateImageUpload({
        size: MAX_MEDIA_BYTES + 1,
        type: "image/png",
        arrayBuffer: async () => new ArrayBuffer(0),
      }),
    ).toThrow("5 MB or smaller");
  });

  it("writes opaque media metadata and cleans up through the injected bucket", async () => {
    await schemaReady;
    const userId = `media-test-${crypto.randomUUID()}`;
    createdUserIds.push(userId);
    await db.insert(user).values({
      id: userId,
      name: "Media Test",
      email: `${userId}@example.com`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const { bucket, objects } = createFakeBucket();
    const service = await createMediaService({ bucket });
    const uploaded = await service.upload({
      ownerId: userId,
      purpose: "avatar",
      file: uploadFile(pngBytes(64, 64)),
    });

    expect(uploaded.objectKey).toMatch(/^media\/[0-9a-f-]+\.png$/);
    expect(uploaded.url).toBe(`/api/media/${uploaded.objectKey}`);
    expect(objects.has(uploaded.objectKey)).toBe(true);

    const row = await db.query.mediaAsset.findFirst({
      where: and(eq(mediaAsset.id, uploaded.id), eq(mediaAsset.ownerId, userId)),
    });
    expect(row).toMatchObject({
      purpose: "avatar",
      status: "pending",
      width: 64,
      height: 64,
    });

    expect(await service.deleteOwnedAsset({ id: uploaded.id, ownerId: userId })).toBe(true);
    expect(objects.has(uploaded.objectKey)).toBe(false);
  });
});
