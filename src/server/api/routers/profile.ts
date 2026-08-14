import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { db, schemaReady } from "~/db";
import { mediaAsset, tweet, user, userFollower } from "~/db/schema";
import { mediaUrl, createMediaService } from "~/server/platform/media";
import { rateLimit, RATE_LIMITS } from "~/lib/ratelimit";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";

const profileUpdateInput = z.object({
  name: z.string().trim().min(1).max(50),
  bio: z.string().trim().max(160),
  avatarMediaId: z.string().trim().min(1).max(200).nullable().optional(),
  removeAvatar: z.boolean().optional().default(false),
});

async function readProfile(id: string, currentUserId?: string) {
  await schemaReady;
  const profile = await db.query.user.findFirst({ where: eq(user.id, id) });
  if (profile == null) return;

  const [followersCountRow, followsCountRow, tweetsCountRow] = await Promise.all([
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
      .where(and(eq(tweet.userId, id), isNull(tweet.parentId), isNull(tweet.deletedAt))),
  ]);

  const followers =
    currentUserId == null
      ? []
      : await db
          .select({ followerId: userFollower.followerId })
          .from(userFollower)
          .where(and(eq(userFollower.followingId, id), eq(userFollower.followerId, currentUserId)))
          .limit(1);

  return {
    followersCount: Number(followersCountRow[0]?.count ?? 0),
    followsCount: Number(followsCountRow[0]?.count ?? 0),
    image: mediaUrl(profile.avatarKey) ?? profile.image,
    hasCustomAvatar: profile.avatarKey != null,
    bio: profile.bio,
    isFollowing: followers.length > 0,
    name: profile.name,
    tweetsCount: Number(tweetsCountRow[0]?.count ?? 0),
  };
}

async function cleanupAttachedAvatars(
  ownerId: string,
  keepMediaId: string | null,
  service: Awaited<ReturnType<typeof createMediaService>>,
) {
  const oldAssets = await db
    .select({ id: mediaAsset.id })
    .from(mediaAsset)
    .where(
      and(
        eq(mediaAsset.ownerId, ownerId),
        eq(mediaAsset.purpose, "avatar"),
        eq(mediaAsset.status, "attached"),
        keepMediaId == null ? undefined : ne(mediaAsset.id, keepMediaId),
      ),
    );

  for (const asset of oldAssets) {
    await service.deleteOwnedAsset({ id: asset.id, ownerId });
  }
}

export const profileRouter = createTRPCRouter({
  getById: publicProcedure
    .input(z.object({ id: z.string().min(1).max(200) }))
    .query(async ({ input: { id }, ctx }) => {
      return await readProfile(id, ctx.session?.user.id);
    }),
  getMe: protectedProcedure.query(async ({ ctx }) => {
    const profile = await readProfile(ctx.session.user.id, ctx.session.user.id);
    if (profile == null) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Profile not found." });
    }
    return profile;
  }),
  updateMe: protectedProcedure
    .input(profileUpdateInput)
    .use(async ({ ctx, next }) => {
      const rateLimitResult = await rateLimit({
        key: `update-profile-${ctx.session.user.id}`,
        limit: RATE_LIMITS.UPDATE_PROFILE.limit,
        window: RATE_LIMITS.UPDATE_PROFILE.window,
      });
      if (!rateLimitResult.success) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Rate limit exceeded. Try again in ${Math.ceil(
            (rateLimitResult.resetAt - Date.now()) / 1000,
          )} seconds.`,
        });
      }
      return next({ ctx });
    })
    .mutation(async ({ input, ctx }) => {
      await schemaReady;
      const userId = ctx.session.user.id;
      const existingUser = await db.query.user.findFirst({
        where: eq(user.id, userId),
      });
      if (existingUser == null) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Profile not found." });
      }

      let selectedAvatar: typeof mediaAsset.$inferSelect | null = null;
      if (input.avatarMediaId != null) {
        selectedAvatar =
          (await db.query.mediaAsset.findFirst({
            where: and(
              eq(mediaAsset.id, input.avatarMediaId),
              eq(mediaAsset.ownerId, userId),
              eq(mediaAsset.purpose, "avatar"),
              eq(mediaAsset.status, "pending"),
              isNull(mediaAsset.tweetId),
            ),
          })) ?? null;

        if (selectedAvatar == null) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "That avatar upload is no longer available.",
          });
        }
      }

      const avatarChanged =
        selectedAvatar != null || (input.removeAvatar && existingUser.avatarKey != null);
      const mediaService = avatarChanged ? await createMediaService() : null;
      const now = new Date().toISOString();
      const nextAvatarKey = input.removeAvatar
        ? null
        : (selectedAvatar?.objectKey ?? existingUser.avatarKey);

      await db.transaction(async (transaction) => {
        await transaction
          .update(user)
          .set({
            name: input.name,
            bio: input.bio || null,
            avatarKey: nextAvatarKey,
            updatedAt: now,
          })
          .where(eq(user.id, userId));

        if (selectedAvatar != null) {
          await transaction
            .update(mediaAsset)
            .set({ status: "attached", attachedAt: now })
            .where(eq(mediaAsset.id, selectedAvatar.id));
        }
      });

      if (mediaService != null) {
        await cleanupAttachedAvatars(userId, selectedAvatar?.id ?? null, mediaService);
      }

      const profile = await readProfile(userId, userId);
      if (profile == null) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Profile not found." });
      }
      return profile;
    }),
  toggleFollow: protectedProcedure
    .input(z.object({ userId: z.string().min(1).max(200) }))
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
            (rateLimitResult.resetAt - Date.now()) / 1000,
          )} seconds.`,
        });
      }
      return next({ ctx });
    })
    .mutation(async ({ input: { userId }, ctx }) => {
      await schemaReady;
      const currentUserId = ctx.session.user.id;
      if (currentUserId === userId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot follow your own profile.",
        });
      }

      const target = await db.query.user.findFirst({
        where: eq(user.id, userId),
      });
      if (target == null) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Profile not found." });
      }

      const existingFollow = await db.query.userFollower.findFirst({
        where: and(
          eq(userFollower.followingId, userId),
          eq(userFollower.followerId, currentUserId),
        ),
      });

      if (existingFollow == null) {
        await db.insert(userFollower).values({ followerId: currentUserId, followingId: userId });
        return { addedFollow: true };
      }

      await db
        .delete(userFollower)
        .where(
          and(eq(userFollower.followingId, userId), eq(userFollower.followerId, currentUserId)),
        );

      return { addedFollow: false };
    }),
});
