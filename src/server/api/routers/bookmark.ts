import { and, desc, eq, isNull, lt, lte, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { db, schemaReady } from "~/db";
import { bookmark, like, tweet, user } from "~/db/schema";
import { mediaUrl } from "~/server/platform/media";
import { rateLimit, RATE_LIMITS } from "~/lib/ratelimit";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { loadMedia } from "./tweet-detail";
import { serializeMedia } from "./tweet-queries";

const bookmarkCursor = z.object({ id: z.string().min(1).max(200), createdAt: z.date() }).optional();

export const bookmarkRouter = createTRPCRouter({
  toggle: protectedProcedure
    .input(z.object({ tweetId: z.string().min(1).max(200) }))
    .use(async ({ ctx, next }) => {
      const rateLimitResult = await rateLimit({
        key: `toggle-bookmark-${ctx.session.user.id}`,
        limit: RATE_LIMITS.TOGGLE_BOOKMARK.limit,
        window: RATE_LIMITS.TOGGLE_BOOKMARK.window,
      });
      if (!rateLimitResult.success) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many bookmark operations. Try again later.",
        });
      }
      return next({ ctx });
    })
    .mutation(async ({ input, ctx }) => {
      await schemaReady;
      const target = await db.query.tweet.findFirst({
        where: eq(tweet.id, input.tweetId),
      });
      if (target == null || target.deletedAt != null) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Post not found." });
      }

      const existing = await db.query.bookmark.findFirst({
        where: and(eq(bookmark.userId, ctx.session.user.id), eq(bookmark.tweetId, input.tweetId)),
      });
      if (existing != null) {
        await db
          .delete(bookmark)
          .where(
            and(eq(bookmark.userId, ctx.session.user.id), eq(bookmark.tweetId, input.tweetId)),
          );
        return { addedBookmark: false };
      }

      await db.insert(bookmark).values({
        userId: ctx.session.user.id,
        tweetId: input.tweetId,
        createdAt: new Date().toISOString(),
      });
      return { addedBookmark: true };
    }),
  infiniteMine: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).optional(),
        cursor: bookmarkCursor,
      }),
    )
    .query(async ({ input, ctx }) => {
      await schemaReady;
      const cursorCreatedAt = input.cursor?.createdAt.toISOString();
      const rows = await db
        .select({
          id: tweet.id,
          content: tweet.content,
          parentId: tweet.parentId,
          createdAt: tweet.createdAt,
          updatedAt: tweet.updatedAt,
          likeCount: sql<number>`(
            select count(*) from ${like} where ${like.tweetId} = ${tweet.id}
          )`,
          likedByMe: sql<number>`exists(
            select 1 from ${like}
            where ${like.tweetId} = ${tweet.id}
              and ${like.userId} = ${ctx.session.user.id}
          )`,
          replyCount: sql<number>`(
            select count(*) from "tweet" as reply
            where reply."parentId" = ${tweet.id}
              and reply."deletedAt" is null
          )`,
          bookmarkedAt: bookmark.createdAt,
          userId: user.id,
          userAvatarKey: user.avatarKey,
          userImage: user.image,
          userName: user.name,
        })
        .from(bookmark)
        .innerJoin(tweet, eq(bookmark.tweetId, tweet.id))
        .innerJoin(user, eq(tweet.userId, user.id))
        .where(
          and(
            eq(bookmark.userId, ctx.session.user.id),
            isNull(tweet.deletedAt),
            cursorCreatedAt == null
              ? undefined
              : or(
                  lt(bookmark.createdAt, cursorCreatedAt),
                  and(eq(bookmark.createdAt, cursorCreatedAt), lte(tweet.id, input.cursor!.id)),
                ),
          ),
        )
        .orderBy(desc(bookmark.createdAt), desc(tweet.id))
        .limit((input.limit ?? 10) + 1);

      let nextCursor: { id: string; createdAt: Date } | undefined;
      const limit = input.limit ?? 10;
      if (rows.length > limit) {
        const nextItem = rows.pop();
        if (nextItem != null) {
          nextCursor = {
            id: nextItem.id,
            createdAt: new Date(nextItem.bookmarkedAt),
          };
        }
      }

      const media = await loadMedia(rows.map((row) => row.id));
      return {
        tweets: rows.map((row) => ({
          id: row.id,
          content: row.content,
          parentId: row.parentId,
          createdAt: new Date(row.createdAt),
          updatedAt: new Date(row.updatedAt),
          likeCount: Number(row.likeCount),
          likedByMe: Boolean(row.likedByMe),
          replyCount: Number(row.replyCount),
          bookmarkedByMe: true,
          media: (media.get(row.id) ?? []).map(serializeMedia),
          user: {
            id: row.userId,
            image: mediaUrl(row.userAvatarKey) ?? row.userImage,
            name: row.userName,
          },
        })),
        nextCursor,
      };
    }),
});
