import { and, eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { db, schemaReady } from "~/db";
import { tweet, user, userFollower } from "~/db/schema";
import { rateLimit, RATE_LIMITS } from "~/lib/ratelimit";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";

export const profileRouter = createTRPCRouter({
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input: { id }, ctx }) => {
      await schemaReady;
      const currentUserId = ctx.session?.user.id;
      const profile = await db.query.user.findFirst({ where: eq(user.id, id) });
      if (profile == null) return;

      const [followersCountRow, followsCountRow, tweetsCountRow] =
        await Promise.all([
          db
            .select({ count: sql<number>`count(*)` })
            .from(userFollower)
            .where(eq(userFollower.followingId, id)),
          db
            .select({ count: sql<number>`count(*)` })
            .from(userFollower)
            .where(eq(userFollower.followerId, id)),
          db
            .select({ count: sql<number>`count(*)` })
            .from(tweet)
            .where(eq(tweet.userId, id)),
        ]);

      const followers =
        currentUserId == null
          ? undefined
          : await db
              .select({ followerId: userFollower.followerId })
              .from(userFollower)
              .where(
                and(
                  eq(userFollower.followingId, id),
                  eq(userFollower.followerId, currentUserId)
                )
              )
              .limit(1);

      return {
        followersCount: Number(followersCountRow[0]?.count ?? 0),
        followsCount: Number(followsCountRow[0]?.count ?? 0),
        image: profile.image,
        isFollowing: followers!.length > 0,
        name: profile.name,
        tweetsCount: Number(tweetsCountRow[0]?.count ?? 0),
      };
    }),
  toggleFollow: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .use(async ({ ctx, next }) => {
      const rateLimitResult = await rateLimit({
        key: `toggle-follow-${ctx.session.user.id}`,
        limit: RATE_LIMITS.TOGGLE_FOLLOW.limit,
        window: RATE_LIMITS.TOGGLE_FOLLOW.window,
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
    .mutation(async ({ input: { userId }, ctx }) => {
      await schemaReady;
      const currentUserId = ctx.session.user.id;
      const existingFollow = await db.query.userFollower.findFirst({
        where: and(
          eq(userFollower.followingId, userId),
          eq(userFollower.followerId, currentUserId)
        ),
      });

      if (existingFollow == null) {
        await db
          .insert(userFollower)
          .values({ followerId: currentUserId, followingId: userId });
        return { addedFollow: true };
      }

      await db
        .delete(userFollower)
        .where(
          and(
            eq(userFollower.followingId, userId),
            eq(userFollower.followerId, currentUserId)
          )
        );

      return { addedFollow: false };
    }),
});
