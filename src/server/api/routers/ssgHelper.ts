import superjson from "superjson";
import { createServerSideHelpers } from "@trpc/react-query/server";
import { appRouter } from "../root";
import { createInnerTRPCContext } from "../trpc";

export function ssgHelper() {
  return createServerSideHelpers({
    router: appRouter,
    ctx: createInnerTRPCContext({ session: null, revalidateSGG: null }), // in doing ssg, dont required information user
    transformer: superjson,
  });
}
