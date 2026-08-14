import { bookmarkRouter } from "~/server/api/routers/bookmark";
import { searchRouter } from "~/server/api/routers/search";
import { tweetRouter } from "~/server/api/routers/tweet";
import { createTRPCRouter } from "~/server/api/trpc";
import { profileRouter } from "./routers/profile";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  tweet: tweetRouter,
  profile: profileRouter,
  bookmark: bookmarkRouter,
  search: searchRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
