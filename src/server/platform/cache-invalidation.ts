export type InvalidatePath = (
  path: string,
  opts?: { unstable_onlyGenerated?: boolean | undefined }
) => Promise<void>;

type PagesRouterRevalidator = {
  revalidate: InvalidatePath;
};

export type CacheInvalidation = {
  invalidatePath: InvalidatePath;
};

const noopInvalidatePath: InvalidatePath = async () => undefined;

export function createNoopCacheInvalidation(): CacheInvalidation {
  return { invalidatePath: noopInvalidatePath };
}

export function createNextPagesCacheInvalidation(
  response: PagesRouterRevalidator
): CacheInvalidation {
  return {
    invalidatePath: (path, opts) => response.revalidate(path, opts),
  };
}
