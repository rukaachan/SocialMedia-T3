import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import type { AppSession } from "~/lib/auth/server";
import { getServerAuthSession } from "~/server/auth";
import { prisma } from "~/server/db";
import {
  createNoopCacheInvalidation,
  type CacheInvalidation,
} from "~/server/platform/cache-invalidation";

type CreateServerContextOptions = {
  session: AppSession | null;
  cacheInvalidation?: CacheInvalidation | null;
  request?: Request | null;
  responseHeaders?: Headers | null;
};

export const createServerContext = (opts: CreateServerContextOptions) => {
  return {
    session: opts.session,
    cacheInvalidation: opts.cacheInvalidation ?? createNoopCacheInvalidation(),
    prisma,
    request: opts.request ?? null,
    responseHeaders: opts.responseHeaders ?? null,
  };
};

export const createFetchServerContext = async (
  opts: FetchCreateContextFnOptions
) => {
  const session = await getServerAuthSession();

  return createServerContext({
    session,
    cacheInvalidation: createNoopCacheInvalidation(),
    request: opts.req,
    responseHeaders: opts.resHeaders,
  });
};
