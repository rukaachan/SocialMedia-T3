import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { db, schemaReady } from "~/db";
import { mediaAsset } from "~/db/schema";
import {
  inspectImage,
  MAX_ALT_TEXT_LENGTH,
  validateImageUpload,
  type MediaPurpose,
  MediaValidationError,
  type UploadFile,
} from "./media-validation";

export { MediaValidationError } from "./media-validation";
export {
  detectImage,
  inspectImage,
  MAX_ALT_TEXT_LENGTH,
  MAX_MEDIA_BYTES,
  MAX_MEDIA_DIMENSION,
  MAX_MEDIA_PIXELS,
  MEDIA_PURPOSES,
  validateImageUpload,
} from "./media-validation";
export type { MediaPurpose, UploadFile } from "./media-validation";

export type MediaBucket = {
  put: (
    key: string,
    value: ArrayBuffer | ArrayBufferView | ReadableStream<Uint8Array>,
    options?: {
      httpMetadata?: {
        contentType?: string;
        cacheControl?: string;
      };
      customMetadata?: Record<string, string>;
    },
  ) => Promise<unknown>;
  get: (key: string) => Promise<MediaObject | null>;
  delete: (key: string) => Promise<void>;
};

type MediaObject = {
  body: ReadableStream<Uint8Array>;
  size: number;
  httpEtag?: string;
  httpMetadata?: {
    contentType?: string;
  };
};

export type MediaServiceDependencies = {
  bucket?: MediaBucket;
  database?: typeof db;
  now?: () => Date;
  createId?: () => string;
};

export async function resolveMediaBucket(): Promise<MediaBucket | null> {
  const context = await getCloudflareContext({ async: true });
  const environment = context.env as { MEDIA_BUCKET?: MediaBucket };
  return environment.MEDIA_BUCKET ?? null;
}

export async function createMediaService(dependencies: MediaServiceDependencies = {}) {
  const database = dependencies.database ?? db;
  const bucket = dependencies.bucket ?? (await resolveMediaBucket());
  const now = dependencies.now ?? (() => new Date());
  const createId = dependencies.createId ?? (() => crypto.randomUUID());

  if (bucket == null) {
    throw new Error("Media storage is not configured.");
  }

  return {
    async upload(input: {
      ownerId: string;
      purpose: MediaPurpose;
      file: UploadFile;
      altText?: string | null;
      sortOrder?: number;
    }) {
      validateImageUpload(input.file);
      const bytes = new Uint8Array(await input.file.arrayBuffer());
      if (bytes.byteLength !== input.file.size) {
        throw new MediaValidationError("The image upload was incomplete.");
      }

      const detected = inspectImage(bytes);
      if (input.file.type.length > 0 && input.file.type !== detected.mimeType) {
        throw new MediaValidationError("The image content type is invalid.", 415);
      }

      const altText = input.altText?.trim() || null;
      if (altText != null && altText.length > MAX_ALT_TEXT_LENGTH) {
        throw new MediaValidationError("Alt text must be 200 characters or fewer.");
      }

      const id = createId();
      const objectKey = `media/${id}.${detected.extension}`;
      const createdAt = now().toISOString();

      try {
        await bucket.put(objectKey, bytes, {
          httpMetadata: {
            contentType: detected.mimeType,
            cacheControl: "public, max-age=31536000, immutable",
          },
          customMetadata: {
            ownerId: input.ownerId,
            purpose: input.purpose,
          },
        });

        await schemaReady;
        await database.insert(mediaAsset).values({
          id,
          ownerId: input.ownerId,
          objectKey,
          purpose: input.purpose,
          status: "pending",
          mimeType: detected.mimeType,
          byteSize: bytes.byteLength,
          width: detected.dimensions.width,
          height: detected.dimensions.height,
          sortOrder: input.sortOrder ?? 0,
          altText,
          createdAt,
        });
      } catch (error) {
        try {
          await bucket.delete(objectKey);
        } catch (cleanupError) {
          console.error("Failed to clean up media object after upload failure", cleanupError);
        }
        throw error;
      }

      return {
        id,
        objectKey,
        url: `/api/media/${objectKey}`,
        purpose: input.purpose,
        mimeType: detected.mimeType,
        byteSize: bytes.byteLength,
        width: detected.dimensions.width,
        height: detected.dimensions.height,
        altText,
        createdAt,
      };
    },

    async abortPendingAsset(input: { id: string; ownerId: string }) {
      await schemaReady;
      const asset = await database.query.mediaAsset.findFirst({
        where: eq(mediaAsset.id, input.id),
      });
      if (
        asset == null ||
        asset.ownerId !== input.ownerId ||
        asset.status !== "pending" ||
        asset.tweetId != null ||
        asset.deletedAt != null
      ) {
        return false;
      }

      await bucket.delete(asset.objectKey);
      await database
        .update(mediaAsset)
        .set({ deletedAt: now().toISOString(), status: "deleted" })
        .where(eq(mediaAsset.id, asset.id));
      return true;
    },

    async deleteOwnedAsset(input: { id: string; ownerId: string }) {
      await schemaReady;
      const asset = await database.query.mediaAsset.findFirst({
        where: eq(mediaAsset.id, input.id),
      });
      if (asset == null || asset.ownerId !== input.ownerId) return false;

      await bucket.delete(asset.objectKey);
      await database
        .update(mediaAsset)
        .set({ deletedAt: now().toISOString(), status: "deleted" })
        .where(eq(mediaAsset.id, asset.id));
      return true;
    },
  };
}

export function mediaUrl(objectKey: string | null | undefined) {
  return objectKey == null ? null : `/api/media/${objectKey}`;
}
