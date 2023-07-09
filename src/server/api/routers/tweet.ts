import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";

export const tweetRouter = createTRPCRouter({
  // infiniteFeed EndPoint TRPC
  infiniteFeed: publicProcedure
    .input(
      z.object({
        // make object for EndPoint limit and cursor
        limit: z.number().optional(),
        cursor: z.object({ id: z.string(), createdAt: z.date() }).optional(),
      })
    )
    .query(async ({ input: { limit = 10, cursor }, ctx }) => {
      // To view tweets that you have already liked, they will not be displayed.
      // To view tweets that you have not liked, they will be shown.
      const currentUserId = ctx.session?.user.id;

      const data = await ctx.prisma.tweet.findMany({
        /**
         * if want to display 10 items per page
         * by adding 1 to the limit, can retrieve 11 itemsadn then use
         * the first 10 items to display on first page
         */
        take: limit + 1,
        cursor: cursor ? { createdAt_id: cursor } : undefined,
        // some error here, because cant select two orderBy
        orderBy: [
          {
            createdAt: "desc",
          },
          {
            id: "desc",
          },
        ],
        // and do select for user tweet
        select: {
          id: true,
          content: true,
          createdAt: true,
          _count: { select: { likes: true } },
          likes:
            currentUserId == null
              ? false
              : { where: { userId: currentUserId } },
          user: {
            select: { name: true, id: true, image: true },
          },
        },
      });
      let nextCursor: typeof cursor | undefined;

      if (data.length > limit) {
        // in here doing some delete array last data
        const nextItem = data.pop();

        // and if not being null, will be stored in a variable
        if (nextItem != null) {
          nextCursor = { id: nextItem.id, createdAt: nextItem.createdAt };
        }
      }

      // return data for frontEnd
      return {
        tweets: data.map((tweet) => {
          return {
            id: tweet.id,
            content: tweet.content,
            createdAt: tweet.createdAt,
            likeCount: tweet._count.likes,
            user: tweet.user,
            likedByMe: tweet.likes?.length > 0,
          };
        }),
        nextCursor,
      };
    }),
  // create EndPoint TRPC
  create: protectedProcedure
    .input(z.object({ content: z.string() }))
    // mutation: for make created and place it into server
    .mutation(async ({ input: { content }, ctx }) => {
      return await ctx.prisma.tweet.create({
        data: {
          content,
          userId: ctx.session.user.id,
        },
      });
    }),
  // toggleLike EndPoint TRPC
  toggleLike: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input: { id }, ctx }) => {
      // declare variable object, that have two properties
      const data = { tweetId: id, userId: ctx.session.user.id };

      const exisitingLike = await ctx.prisma.like.findUnique({
        where: {
          userId_tweetId: data, // and put initialization variabel data
        },
      });

      if (exisitingLike == null) {
        await ctx.prisma.like.create({
          data,
        });
        return { addedLike: true }; // return some object
      } else {
        await ctx.prisma.like.delete({
          where: {
            userId_tweetId: data,
          },
        });
        return { addedLike: false }; // return some object
      }
    }),
});
