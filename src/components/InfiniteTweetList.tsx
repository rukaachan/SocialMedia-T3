import { useInfiniteScroll } from "~/hooks/useInfiniteScroll";
import TweetCard, { type Tweet } from "./TweetCard";
import LoadingSpinner from "./LoadingSpinner";

type InfiniteTweetListProps = {
  isLoading: boolean;
  isError: boolean;
  hasMore: boolean;
  fetchNewTweets: () => Promise<unknown>;
  tweets?: Tweet[];
};

export default function InfiniteTweetList({
  tweets,
  isError,
  isLoading,
  hasMore,
  fetchNewTweets,
}: InfiniteTweetListProps) {
  const { loadMoreRef, isFetchingMore } = useInfiniteScroll({
    fetchMore: fetchNewTweets,
    hasMore,
    rootMargin: "200px 0px",
  });

  if (isLoading) return <LoadingSpinner />;
  if (isError) {
    return <h1 className="my-4 text-center text-2xl text-gray-500">We could not load posts.</h1>;
  }
  if (!tweets || tweets.length === 0) {
    return <h2 className="my-4 text-center text-2xl text-gray-500">No posts yet.</h2>;
  }

  return (
    <>
      <ul>
        {tweets.map((tweet) => (
          <TweetCard key={tweet.id} {...tweet} />
        ))}
      </ul>

      {hasMore && (
        <div ref={loadMoreRef} className="flex justify-center py-4">
          {isFetchingMore && <LoadingSpinner />}
        </div>
      )}
    </>
  );
}
