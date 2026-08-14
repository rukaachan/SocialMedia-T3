import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { deleteTweetProcedure, toggleLikeProcedure, updateTweetProcedure } from "./tweet-actions";
import { createTweetProcedure, replyProcedure } from "./tweet-create";
import { getInfiniteReplies, getTweetById } from "./tweet-detail";
import { getInfiniteTweets } from "./tweet-queries";

const cursorInput = z.object({ id: z.string().min(1).max(200), createdAt: z.date() }).optional();

export const tweetRouter = createTRPCRouter({
  getById: publicProcedure
    .input(z.object({ id: z.string().min(1).max(200) }))
    .query(async ({ input, ctx }) => {
      return await getTweetById(input.id, ctx.session?.user.id);
    }),
  infiteProfile: publicProcedure
    .input(
      z.object({
        userId: z.string().min(1).max(100),
        limit: z.number().min(1).max(50).optional(),
        cursor: cursorInput,
      }),
    )
    .query(async ({ input, ctx }) => {
      return await getInfiniteTweets({
        currentUserId: ctx.session?.user.id,
        cursor: input.cursor,
        limit: input.limit ?? 10,
        userId: input.userId,
      });
    }),
  infiniteFeed: publicProcedure
    .input(
      z.object({
        onlyFollowing: z.boolean().optional(),
        limit: z.number().min(1).max(50).optional(),
        cursor: cursorInput,
      }),
    )
    .query(async ({ input, ctx }) => {
      return await getInfiniteTweets({
        currentUserId: ctx.session?.user.id,
        cursor: input.cursor,
        limit: input.limit ?? 10,
        onlyFollowing: input.onlyFollowing ?? false,
      });
    }),
  infiniteReplies: publicProcedure
    .input(
      z.object({
        tweetId: z.string().min(1).max(200),
        limit: z.number().min(1).max(50).optional(),
        cursor: cursorInput,
      }),
    )
    .query(async ({ input, ctx }) => {
      return await getInfiniteReplies({
        tweetId: input.tweetId,
        currentUserId: ctx.session?.user.id,
        limit: input.limit ?? 10,
        cursor: input.cursor,
      });
    }),
  create: createTweetProcedure,
  reply: replyProcedure,
  update: updateTweetProcedure,
  delete: deleteTweetProcedure,
  toggleLike: toggleLikeProcedure,
});
