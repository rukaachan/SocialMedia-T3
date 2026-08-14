"use client";

import Link from "next/link";
import LoadingSpinner from "~/components/LoadingSpinner";
import TweetCard from "~/components/TweetCard";
import { useInfiniteScroll } from "~/hooks/useInfiniteScroll";
import { useSession } from "~/lib/auth/client";
import { api } from "~/utils/api";

export default function BookmarksPage() {
  const session = useSession();
  const bookmarks = api.bookmark.infiniteMine.useInfiniteQuery(
    {},
    {
      enabled: session.status === "authenticated",
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    },
  );
  const { loadMoreRef, isFetchingMore } = useInfiniteScroll({
    fetchMore: bookmarks.fetchNextPage,
    hasMore: bookmarks.hasNextPage ?? false,
    enabled: session.status === "authenticated" && !bookmarks.isLoading,
    rootMargin: "200px 0px",
  });

  if (session.status !== "authenticated") {
    return (
      <main className="px-4 py-12 text-center">
        <h1 className="text-xl font-semibold">Your bookmarks</h1>
        <p className="mt-2 text-slate-600">Sign in to save posts for later.</p>
        <Link
          href="/auth/sign-in"
          className="mt-4 inline-block rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          Sign in
        </Link>
      </main>
    );
  }

  const tweets = bookmarks.data?.pages.flatMap((page) => page.tweets) ?? [];

  return (
    <main>
      <header className="sticky top-0 z-10 border-b bg-white px-4 py-4">
        <h1 className="text-lg font-bold">Bookmarks</h1>
      </header>
      {bookmarks.isLoading && <LoadingSpinner />}
      {bookmarks.isError && (
        <p role="alert" className="px-4 py-8 text-center text-red-700">
          Bookmarks are unavailable right now.
        </p>
      )}
      {!bookmarks.isLoading && !bookmarks.isError && tweets.length === 0 && (
        <p className="px-4 py-8 text-center text-slate-600">
          You have not bookmarked any posts yet.
        </p>
      )}
      {tweets.length > 0 && (
        <ul>
          {tweets.map((tweet) => (
            <TweetCard key={tweet.id} {...tweet} />
          ))}
        </ul>
      )}
      {bookmarks.hasNextPage && (
        <div ref={loadMoreRef} className="flex justify-center py-4">
          {isFetchingMore && <LoadingSpinner />}
        </div>
      )}
    </main>
  );
}
