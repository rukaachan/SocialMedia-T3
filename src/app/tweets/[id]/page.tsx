"use client";

import Link from "next/link";
import ErrorPage from "next/error";
import { VscArrowLeft } from "react-icons/vsc";
import IconHoverEffect from "~/components/IconHoverEffect";
import LoadingSpinner from "~/components/LoadingSpinner";
import ReplyComposer from "~/components/ReplyComposer";
import TweetCard from "~/components/TweetCard";
import { useInfiniteScroll } from "~/hooks/useInfiniteScroll";
import { api } from "~/utils/api";

export default function TweetThreadPage({ params }: { params: { id: string } }) {
  const id = params.id;
  const tweet = api.tweet.getById.useQuery({ id });
  const replies = api.tweet.infiniteReplies.useInfiniteQuery(
    { tweetId: id },
    { getNextPageParam: (lastPage) => lastPage.nextCursor },
  );
  const { loadMoreRef, isFetchingMore } = useInfiniteScroll({
    fetchMore: replies.fetchNextPage,
    hasMore: replies.hasNextPage ?? false,
    rootMargin: "200px 0px",
    enabled: !replies.isLoading,
  });

  if (tweet.isLoading) return <LoadingSpinner />;
  if (tweet.isError) {
    return <p className="px-4 py-8 text-center text-red-700">Post could not be loaded.</p>;
  }
  if (tweet.data == null) return <ErrorPage statusCode={404} />;

  const replyItems = replies.data?.pages.flatMap((page) => page.tweets) ?? [];

  return (
    <main>
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b bg-white px-4 py-2">
        <Link
          href="/"
          aria-label="Back to home"
          className="rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          <IconHoverEffect>
            <VscArrowLeft className="h-6 w-6" />
          </IconHoverEffect>
        </Link>
        <h1 className="text-lg font-bold">Thread</h1>
      </header>

      <TweetCard {...tweet.data} />
      {!tweet.data.isDeleted && <ReplyComposer parentId={id} />}

      <section aria-labelledby="replies-heading">
        <h2 id="replies-heading" className="px-4 py-4 text-lg font-semibold">
          Replies
        </h2>
        {replies.isLoading && <LoadingSpinner />}
        {replies.isError && (
          <p role="alert" className="px-4 pb-4 text-sm text-red-700">
            Replies could not be loaded.
          </p>
        )}
        {!replies.isLoading && replyItems.length === 0 && (
          <p className="border-b px-4 pb-4 text-sm text-slate-600">No replies yet.</p>
        )}
        {replyItems.length > 0 && (
          <ul>
            {replyItems.map((reply) => (
              <TweetCard key={reply.id} {...reply} threadId={id} />
            ))}
          </ul>
        )}
        {replies.hasNextPage && (
          <div ref={loadMoreRef} className="flex justify-center py-4">
            {isFetchingMore && <LoadingSpinner />}
          </div>
        )}
      </section>
    </main>
  );
}
