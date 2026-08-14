import { and, eq, inArray, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { db, schemaReady } from "~/db";
import { mediaAsset, tweet } from "~/db/schema";
import { rateLimit, RATE_LIMITS } from "~/lib/ratelimit";
import { protectedProcedure } from "~/server/api/trpc";
import { serializeMedia } from "./tweet-queries";

const postContent = z.string().trim().min(1).max(500);

export const createTweetProcedure = protectedProcedure
  .input(
    z.object({
      content: postContent,
      mediaIds: z.array(z.string().min(1).max(200)).max(4).default([]),
    }),
  )
  .use(async ({ ctx, next }) => {
    const rateLimitResult = await rateLimit({
      key: `create-tweet-${ctx.session.user.id}`,
      limit: RATE_LIMITS.CREATE_TWEET.limit,
      window: RATE_LIMITS.CREATE_TWEET.window,
    });
    if (!rateLimitResult.success) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Too many posts. Try again later.",
      });
    }
    return next({ ctx });
  })
  .mutation(async ({ input: { content, mediaIds }, ctx }) => {
    await schemaReady;
    const userId = ctx.session.user.id;
    const uniqueMediaIds = new Set(mediaIds);
    if (uniqueMediaIds.size !== mediaIds.length) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "An image cannot be attached more than once.",
      });
    }

    const attachments =
      mediaIds.length === 0
        ? []
        : await db
            .select()
            .from(mediaAsset)
            .where(
              and(
                inArray(mediaAsset.id, mediaIds),
                eq(mediaAsset.ownerId, userId),
                eq(mediaAsset.purpose, "post"),
                eq(mediaAsset.status, "pending"),
                isNull(mediaAsset.tweetId),
                isNull(mediaAsset.deletedAt),
              ),
            );

    if (attachments.length !== mediaIds.length) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "One or more image uploads are no longer available.",
      });
    }
    if (attachments.some((asset) => asset.altText == null || asset.altText.length === 0)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Add alt text to every attached image.",
      });
    }

    const attachmentById = new Map(attachments.map((attachment) => [attachment.id, attachment]));
    const createdAt = new Date();
    const timestamp = createdAt.toISOString();
    const id = crypto.randomUUID();

    await db.transaction(async (transaction) => {
      await transaction.insert(tweet).values({
        content,
        createdAt: timestamp,
        updatedAt: timestamp,
        id,
        userId,
      });

      for (const [sortOrder, mediaId] of mediaIds.entries()) {
        if (!attachmentById.has(mediaId)) continue;
        await transaction
          .update(mediaAsset)
          .set({
            tweetId: id,
            status: "attached",
            sortOrder,
            attachedAt: timestamp,
          })
          .where(eq(mediaAsset.id, mediaId));
      }
    });

    return {
      content,
      createdAt,
      updatedAt: createdAt,
      id,
      media: mediaIds.map((mediaId) => serializeMedia(attachmentById.get(mediaId)!)),
      bookmarkedByMe: false,
      parentId: null,
      userId,
    };
  });

export const replyProcedure = protectedProcedure
  .input(
    z.object({
      parentId: z.string().min(1).max(200),
      content: postContent,
    }),
  )
  .use(async ({ ctx, next }) => {
    const rateLimitResult = await rateLimit({
      key: `create-reply-${ctx.session.user.id}`,
      limit: RATE_LIMITS.CREATE_REPLY.limit,
      window: RATE_LIMITS.CREATE_REPLY.window,
    });
    if (!rateLimitResult.success) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Too many replies. Try again later.",
      });
    }
    return next({ ctx });
  })
  .mutation(async ({ input, ctx }) => {
    await schemaReady;
    const parent = await db.query.tweet.findFirst({
      where: eq(tweet.id, input.parentId),
    });
    if (parent == null || parent.deletedAt != null || parent.parentId != null) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Replies can only be added to an active top-level post.",
      });
    }

    const createdAt = new Date();
    const id = crypto.randomUUID();
    await db.insert(tweet).values({
      id,
      userId: ctx.session.user.id,
      content: input.content,
      parentId: parent.id,
      createdAt: createdAt.toISOString(),
      updatedAt: createdAt.toISOString(),
    });

    return {
      id,
      userId: ctx.session.user.id,
      parentId: parent.id,
      content: input.content,
      createdAt,
      updatedAt: createdAt,
      bookmarkedByMe: false,
      media: [],
    };
  });
