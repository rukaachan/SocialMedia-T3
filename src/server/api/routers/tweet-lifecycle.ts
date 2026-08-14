import { and, eq, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { db, schemaReady } from "~/db";
import { mediaAsset, tweet } from "~/db/schema";
import { createMediaService } from "~/server/platform/media";

function assertOwner(ownerId: string, currentUserId: string) {
  if (ownerId !== currentUserId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You can only manage your own posts.",
    });
  }
}

export async function updateOwnedTweet(input: { id: string; userId: string; content: string }) {
  await schemaReady;
  const existing = await db.query.tweet.findFirst({
    where: eq(tweet.id, input.id),
  });
  if (existing == null) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Post not found." });
  }

  assertOwner(existing.userId, input.userId);
  if (existing.deletedAt != null) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Deleted posts cannot be edited.",
    });
  }

  const updatedAt = new Date().toISOString();
  await db.update(tweet).set({ content: input.content, updatedAt }).where(eq(tweet.id, input.id));

  return {
    id: input.id,
    content: input.content,
    createdAt: new Date(existing.createdAt),
    updatedAt: new Date(updatedAt),
  };
}

export async function deleteOwnedTweet(input: { id: string; userId: string }) {
  await schemaReady;
  const existing = await db.query.tweet.findFirst({
    where: eq(tweet.id, input.id),
  });
  if (existing == null) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Post not found." });
  }

  assertOwner(existing.userId, input.userId);
  if (existing.deletedAt != null) {
    return {
      id: existing.id,
      deletedAt: new Date(existing.deletedAt),
      updatedAt: new Date(existing.updatedAt),
    };
  }

  const assets = await db
    .select({ id: mediaAsset.id })
    .from(mediaAsset)
    .where(
      and(
        eq(mediaAsset.tweetId, input.id),
        eq(mediaAsset.ownerId, input.userId),
        isNull(mediaAsset.deletedAt),
      ),
    );
  let mediaService: Awaited<ReturnType<typeof createMediaService>> | null = null;
  if (assets.length > 0) {
    try {
      mediaService = await createMediaService();
    } catch (error) {
      console.error("Media storage unavailable during post deletion", error);
    }
  }
  const deletedAt = new Date().toISOString();

  await db.transaction(async (transaction) => {
    await transaction
      .update(tweet)
      .set({ deletedAt, updatedAt: deletedAt })
      .where(eq(tweet.id, input.id));

    if (assets.length > 0) {
      await transaction
        .update(mediaAsset)
        .set({ deletedAt, status: "deleted" })
        .where(eq(mediaAsset.tweetId, input.id));
    }
  });

  if (mediaService != null) {
    for (const asset of assets) {
      try {
        await mediaService.deleteOwnedAsset({ id: asset.id, ownerId: input.userId });
      } catch (error) {
        console.error("Failed to delete a post media object", error);
      }
    }
  }

  return {
    id: existing.id,
    deletedAt: new Date(deletedAt),
    updatedAt: new Date(deletedAt),
  };
}
