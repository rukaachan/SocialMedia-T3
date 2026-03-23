import { useEffect, useRef, useState } from "react";

type UseInfiniteScrollOptions = {
  enabled?: boolean;
  fetchMore: () => Promise<unknown>;
  hasMore: boolean;
  rootMargin?: string;
};

export function useInfiniteScroll({
  enabled = true,
  fetchMore,
  hasMore,
  rootMargin = "0px",
}: UseInfiniteScrollOptions) {
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const isFetchingMoreRef = useRef(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  useEffect(() => {
    const loadMoreNode = loadMoreRef.current;

    if (
      !enabled ||
      loadMoreNode == null ||
      !hasMore ||
      typeof IntersectionObserver === "undefined"
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const firstEntry = entries[0];

        if (firstEntry?.isIntersecting !== true || isFetchingMoreRef.current) {
          return;
        }

        isFetchingMoreRef.current = true;
        setIsFetchingMore(true);

        void Promise.resolve(fetchMore()).finally(() => {
          isFetchingMoreRef.current = false;
          setIsFetchingMore(false);
        });
      },
      { rootMargin }
    );

    observer.observe(loadMoreNode);

    return () => {
      observer.disconnect();
    };
  }, [enabled, fetchMore, hasMore, rootMargin]);

  return { loadMoreRef, isFetchingMore };
}
