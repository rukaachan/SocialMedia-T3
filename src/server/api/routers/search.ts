import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { db, schemaReady } from "~/db";
import { bookmark, like, tweet, user } from "~/db/schema";
import { mediaUrl } from "~/server/platform/media";
import { rateLimit, RATE_LIMITS } from "~/lib/ratelimit";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { loadMedia } from "./tweet-detail";
import { serializeMedia } from "./tweet-queries";

function escapeLike(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

function contains(column: unknown, pattern: string) {
  return sql`lower(${column}) like ${pattern} escape '\\'`;
}

export const searchRouter = createTRPCRouter({
  all: publicProcedure
    .input(z.object({ q: z.string().trim().min(2).max(80) }))
    .use(async ({ ctx, next }) => {
      const requester =
        ctx.session?.user.id ?? ctx.request?.headers.get("cf-connecting-ip") ?? "anonymous";
      const rateLimitResult = await rateLimit({
        key: `search-${requester}`,
        limit: RATE_LIMITS.SEARCH.limit,
        window: RATE_LIMITS.SEARCH.window,
      });
      if (!rateLimitResult.success) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many searches. Try again later.",
        });
      }
      return next({ ctx });
    })
    .query(async ({ input, ctx }) => {
      await schemaReady;
      const pattern = `%${escapeLike(input.q.toLowerCase())}%`;
      const currentUserId = ctx.session?.user.id;

      const [users, rows] = await Promise.all([
        db
          .select({
            id: user.id,
            name: user.name,
            bio: user.bio,
            avatarKey: user.avatarKey,
            image: user.image,
          })
          .from(user)
          .where(contains(user.name, pattern))
          .orderBy(desc(user.updatedAt), desc(user.id))
          .limit(10),
        db
          .select({
            id: tweet.id,
            content: tweet.content,
            parentId: tweet.parentId,
            createdAt: tweet.createdAt,
            updatedAt: tweet.updatedAt,
            likeCount: sql<number>`(
              select count(*) from ${like} where ${like.tweetId} = ${tweet.id}
            )`,
            likedByMe:
              currentUserId == null
                ? sql<number>`0`
                : sql<number>`exists(
                    select 1 from ${like}
                    where ${like.tweetId} = ${tweet.id}
                      and ${like.userId} = ${currentUserId}
                  )`,
            bookmarkedByMe:
              currentUserId == null
                ? sql<number>`0`
                : sql<number>`exists(
                    select 1 from ${bookmark}
                    where ${bookmark.tweetId} = ${tweet.id}
                      and ${bookmark.userId} = ${currentUserId}
                  )`,
            replyCount: sql<number>`(
              select count(*) from "tweet" as reply
              where reply."parentId" = ${tweet.id}
                and reply."deletedAt" is null
            )`,
            userId: user.id,
            userAvatarKey: user.avatarKey,
            userImage: user.image,
            userName: user.name,
          })
          .from(tweet)
          .innerJoin(user, eq(tweet.userId, user.id))
          .where(
            and(
              isNull(tweet.parentId),
              isNull(tweet.deletedAt),
              or(contains(tweet.content, pattern), contains(user.name, pattern)),
            ),
          )
          .orderBy(desc(tweet.createdAt), desc(tweet.id))
          .limit(20),
      ]);

      const media = await loadMedia(rows.map((row) => row.id));
      return {
        users: users.map((result) => ({
          id: result.id,
          name: result.name,
          bio: result.bio,
          image: mediaUrl(result.avatarKey) ?? result.image,
        })),
        tweets: rows.map((row) => ({
          id: row.id,
          content: row.content,
          parentId: row.parentId,
          createdAt: new Date(row.createdAt),
          updatedAt: new Date(row.updatedAt),
          likeCount: Number(row.likeCount),
          likedByMe: Boolean(row.likedByMe),
          bookmarkedByMe: Boolean(row.bookmarkedByMe),
          replyCount: Number(row.replyCount),
          media: (media.get(row.id) ?? []).map(serializeMedia),
          user: {
            id: row.userId,
            image: mediaUrl(row.userAvatarKey) ?? row.userImage,
            name: row.userName,
          },
        })),
      };
    }),
});
