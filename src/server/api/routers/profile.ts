import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

export const profileRouter = createTRPCRouter({
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
});
