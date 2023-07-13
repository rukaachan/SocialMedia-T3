import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";

export const profileRouter = createTRPCRouter({
  // getById EndPoint TRPC
  getById: publicProcedure
    .input(
      z.object(
        // make object for EndPoint id
        { id: z.string() }
      )
    )
    // doing with query
    .query(async ({ input: { id }, ctx }) => {
      const currentUserId = ctx.session?.user.id;

      // find user by id with unique
      const profile = await ctx.prisma.user.findUnique({
        where: { id },

        // be select
        select: {
          name: true,
          image: true,
          _count: { select: { followers: true, follows: true, tweets: true } }, // must be true for _count
          followers:
            currentUserId == null
              ? undefined
              : { where: { id: currentUserId } },
        },
      });

      if (profile == null) return;

      // return into for FrontEnd
      return {
        name: profile?.name,
        image: profile?.image,
        followersCount: profile?._count.followers,
        followsCount: profile?._count.follows,
        tweetsCount: profile?._count.tweets,
        isFollowing: profile?.followers.length > 0,
      };
    }),
  // toggleFollow EndPoint TRPC
  toggleFollow: protectedProcedure
    .input(
      z.object(
        // make object for EndPoint userId
        { userId: z.string() }
      )
    )
    .mutation(async ({ input: { userId }, ctx }) => {
      const currentUserId = ctx.session?.user.id;

      const existingFollow = await ctx.prisma.user.findFirst({
        where: {
          id: userId,
          followers: { some: { id: currentUserId } },
        },
      });

      /* 
      Update the user's followers in the database.
      If a follower with a specific ID exists, disconnect the user from that follower.
      If a follower with a specific ID does not exist, connect the user to that follower.
      Return an object indicating whether a follower was added or not.
      */
      let addedFollow;
      if (existingFollow == null) {
        await ctx.prisma.user.update({
          where: { id: userId },
          data: { followers: { connect: { id: currentUserId } } },
        });
        addedFollow = true;
      } else {
        await ctx.prisma.user.update({
          where: { id: userId },
          data: { followers: { disconnect: { id: currentUserId } } },
        });
        addedFollow = false;
      }
      // Revalidation

      return { addedFollow };
    }),
});
