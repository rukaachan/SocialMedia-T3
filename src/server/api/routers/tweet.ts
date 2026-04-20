import { and, desc, eq, lt, lte, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { db, schemaReady } from "~/db";
import { like, tweet, user, userFollower } from "~/db/schema";
import { rateLimit, RATE_LIMITS } from "~/lib/ratelimit";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";

export const tweetRouter = createTRPCRouter({
  infiteProfile: publicProcedure
    .input(
      z.object({
        userId: z.string().min(1).max(100),
        limit: z.number().min(1).max(50).optional(),
        cursor: z.object({ id: z.string(), createdAt: z.date() }).optional(),
      })
    )
    .query(async ({ input: { limit = 10, userId, cursor }, ctx }) => {
      return await getInfiniteTweets({
        currentUserId: ctx.session?.user.id,
        cursor,
        limit,
        userId,
      });
    }),
  infiniteFeed: publicProcedure
    .input(
      z.object({
        onlyFollowing: z.boolean().optional(),
        limit: z.number().min(1).max(50).optional(),
        cursor: z.object({ id: z.string(), createdAt: z.date() }).optional(),
      })
    )
    .query(
      async ({ input: { limit = 10, onlyFollowing = false, cursor }, ctx }) => {
        return await getInfiniteTweets({
          currentUserId: ctx.session?.user.id,
          cursor,
          limit,
          onlyFollowing,
        });
      }
    ),
  create: protectedProcedure
    .input(z.object({ content: z.string().min(1).max(500) }))
    .use(async ({ ctx, next }) => {
      const rateLimitResult = await rateLimit({
        key: `create-tweet-${ctx.session.user.id}`,
        limit: RATE_LIMITS.CREATE_TWEET.limit,
        window: RATE_LIMITS.CREATE_TWEET.window,
      });
      if (!rateLimitResult.success) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Rate limit exceeded. Try again in ${Math.ceil(
            (rateLimitResult.resetAt - Date.now()) / 1000
          )} seconds.`,
        });
      }
      return next({ ctx });
    })
    .mutation(async ({ input: { content }, ctx }) => {
      await schemaReady;
      const createdAt = new Date();
      const id = crypto.randomUUID();

      await db.insert(tweet).values({
        content,
        createdAt: createdAt.toISOString(),
        id,
        userId: ctx.session.user.id,
      });

      return {
        content,
        createdAt,
        id,
        userId: ctx.session.user.id,
      };
    }),
  toggleLike: protectedProcedure
    .input(z.object({ id: z.string() }))
    .use(async ({ ctx, next }) => {
      const rateLimitResult = await rateLimit({
        key: `toggle-like-${ctx.session.user.id}`,
        limit: RATE_LIMITS.TOGGLE_LIKE.limit,
        window: RATE_LIMITS.TOGGLE_LIKE.window,
      });
      if (!rateLimitResult.success) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Rate limit exceeded. Try again in ${Math.ceil(
            (rateLimitResult.resetAt - Date.now()) / 1000
          )} seconds.`,
        });
      }
      return next({ ctx });
    })
    .mutation(async ({ input: { id }, ctx }) => {
      await schemaReady;
      const data = { tweetId: id, userId: ctx.session.user.id };
      const existingLike = await db.query.like.findFirst({
        where: and(
          eq(like.tweetId, data.tweetId),
          eq(like.userId, data.userId)
        ),
      });

      if (existingLike == null) {
        await db.insert(like).values(data);
        return { addedLike: true };
      }

      await db
        .delete(like)
        .where(
          and(eq(like.tweetId, data.tweetId), eq(like.userId, data.userId))
        );

      return { addedLike: false };
    }),
});

function combineFilters(filters: Array<any | undefined>) {
  const activeFilters = filters.filter(
    (filter): filter is any => filter != null
  );

  if (activeFilters.length === 0) return undefined;
  if (activeFilters.length === 1) return activeFilters[0];

  return and(...activeFilters);
}

async function getInfiniteTweets({
  currentUserId,
  cursor,
  limit,
  onlyFollowing = false,
  userId,
}: {
  currentUserId?: string;
  cursor?: { id: string; createdAt: Date };
  limit: number;
  onlyFollowing?: boolean;
  userId?: string;
}) {
  await schemaReady;
  const cursorCreatedAt = cursor?.createdAt.toISOString();
  const rows = await db
    .select({
      content: tweet.content,
      createdAt: tweet.createdAt,
      id: tweet.id,
      likeCount: sql<number>`(
        select count(*) from ${like} where ${like.tweetId} = ${tweet.id}
      )`,
      likedByMe:
        currentUserId == null
          ? sql<number>`0`
          : sql<number>`exists(
              select 1 from ${like}
              where ${like.tweetId} = ${tweet.id} and ${like.userId} = ${currentUserId}
            )`,
      userId: user.id,
      userImage: user.image,
      userName: user.name,
    })
    .from(tweet)
    .innerJoin(user, eq(tweet.userId, user.id))
    .where(
      combineFilters([
        userId == null ? undefined : eq(tweet.userId, userId),
        currentUserId == null || !onlyFollowing
          ? undefined
          : sql`exists(
              select 1 from ${userFollower}
              where ${userFollower.followingId} = ${tweet.userId}
                and ${userFollower.followerId} = ${currentUserId}
            )`,
        cursorCreatedAt == null
          ? undefined
          : or(
              lt(tweet.createdAt, cursorCreatedAt),
              and(
                eq(tweet.createdAt, cursorCreatedAt),
                lte(tweet.id, cursor!.id)
              )
            ),
      ])
    )
    .orderBy(desc(tweet.createdAt), desc(tweet.id))
    .limit(limit + 1);

  let nextCursor: { id: string; createdAt: Date } | undefined;

  if (rows.length > limit) {
    const nextItem = rows.pop();

    if (nextItem != null) {
      nextCursor = {
        createdAt: new Date(nextItem.createdAt),
        id: nextItem.id,
      };
    }
  }

  return {
    tweets: rows.map((row) => ({
      content: row.content,
      createdAt: new Date(row.createdAt),
      id: row.id,
      likeCount: Number(row.likeCount),
      likedByMe: Boolean(row.likedByMe),
      user: {
        id: row.userId,
        image: row.userImage,
        name: row.userName,
      },
    })),
    nextCursor,
  };
}
