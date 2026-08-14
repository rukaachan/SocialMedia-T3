import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { db, schemaReady } from "~/db";
import { like, tweet } from "~/db/schema";
import { rateLimit, RATE_LIMITS } from "~/lib/ratelimit";
import { protectedProcedure } from "~/server/api/trpc";
import { deleteOwnedTweet, updateOwnedTweet } from "./tweet-lifecycle";

export const updateTweetProcedure = protectedProcedure
  .input(
    z.object({
      id: z.string().min(1).max(200),
      content: z.string().trim().min(1).max(500),
    }),
  )
  .use(async ({ ctx, next }) => {
    const rateLimitResult = await rateLimit({
      key: `update-tweet-${ctx.session.user.id}`,
      limit: RATE_LIMITS.UPDATE_TWEET.limit,
      window: RATE_LIMITS.UPDATE_TWEET.window,
    });
    if (!rateLimitResult.success) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Too many post edits. Try again later.",
      });
    }
    return next({ ctx });
  })
  .mutation(async ({ input, ctx }) => {
    return await updateOwnedTweet({ ...input, userId: ctx.session.user.id });
  });

export const deleteTweetProcedure = protectedProcedure
  .input(z.object({ id: z.string().min(1).max(200) }))
  .use(async ({ ctx, next }) => {
    const rateLimitResult = await rateLimit({
      key: `delete-tweet-${ctx.session.user.id}`,
      limit: RATE_LIMITS.DELETE_TWEET.limit,
      window: RATE_LIMITS.DELETE_TWEET.window,
    });
    if (!rateLimitResult.success) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Too many post deletions. Try again later.",
      });
    }
    return next({ ctx });
  })
  .mutation(async ({ input, ctx }) => {
    return await deleteOwnedTweet({ ...input, userId: ctx.session.user.id });
  });

export const toggleLikeProcedure = protectedProcedure
  .input(z.object({ id: z.string().min(1).max(200) }))
  .use(async ({ ctx, next }) => {
    const rateLimitResult = await rateLimit({
      key: `toggle-like-${ctx.session.user.id}`,
      limit: RATE_LIMITS.TOGGLE_LIKE.limit,
      window: RATE_LIMITS.TOGGLE_LIKE.window,
    });
    if (!rateLimitResult.success) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Too many like operations. Try again later.",
      });
    }
    return next({ ctx });
  })
  .mutation(async ({ input: { id }, ctx }) => {
    await schemaReady;
    const target = await db.query.tweet.findFirst({ where: eq(tweet.id, id) });
    if (target == null || target.deletedAt != null) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Post not found." });
    }

    const data = { tweetId: id, userId: ctx.session.user.id };
    const existingLike = await db.query.like.findFirst({
      where: and(eq(like.tweetId, data.tweetId), eq(like.userId, data.userId)),
    });

    if (existingLike == null) {
      await db.insert(like).values(data);
      return { addedLike: true };
    }

    await db.delete(like).where(and(eq(like.tweetId, data.tweetId), eq(like.userId, data.userId)));

    return { addedLike: false };
  });
