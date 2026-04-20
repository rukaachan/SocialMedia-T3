import { useInfiniteScroll } from "~/hooks/useInfiniteScroll";
import ProfileImage from "./ProfileImage";
import Link from "next/link";
import { VscHeart, VscHeartFilled } from "react-icons/vsc";
import IconHoverEffect from "./IconHoverEffect";
import { useSession } from "~/lib/auth/client";
import { api } from "~/utils/api";
import LoadingSpinner from "./LoadingSpinner";

type Tweet = {
  id: string;
  content: string;
  createdAt: Date;
  likeCount: number;
  likedByMe: boolean;
  user: { id: string; image: string | null; name: string | null };
};

type InfiniteTweetListProps = {
  isLoading: boolean;
  isError: boolean;
  hasMore: boolean;
  fetchNewTweets: () => Promise<unknown>;
  tweets?: Tweet[];
};

// set-up for InfiniteTweetList, and props
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
  if (isError)
    return (
      <h1 className="my-4 text-center text-2xl text-gray-500">Error....</h1>
    );
  if (!tweets || tweets.length === 0) {
    return (
      <h2 className="my-4 text-center text-2xl text-gray-500">No Tweets</h2>
    );
  }

  return (
    <>
      <ul>
        {tweets.map((tweet) => {
          return <TweetCard key={tweet.id} {...tweet} />;
        })}
      </ul>

      {hasMore && (
        <div ref={loadMoreRef} className="flex justify-center py-4">
          {isFetchingMore && <LoadingSpinner />}
        </div>
      )}
    </>
  );
}

// format dateTime
const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "short",
});

// tweet card, for every single tweet
function TweetCard({
  id,
  user,
  content,
  createdAt,
  likeCount,
  likedByMe,
}: Tweet) {
  const trpcUtils = api.useContext();

  const toggleLike = api.tweet.toggleLike.useMutation({
    onSuccess: ({ addedLike }) => {
      // accept Parameters with name oldData, that get it a second parameter of the setInfiniteFeed function.
      const updateData: Parameters<
        typeof trpcUtils.tweet.infiniteFeed.setInfiniteData
      >[1] = (oldData) => {
        // Check if the oldData is null or undefined
        if (oldData == null) return;

        // Determine the count modifier based on whether a like was added or removed
        const countModifier = addedLike ? 1 : -1;

        // Update the oldData by mapping over the pages and tweets
        return {
          ...oldData,
          pages: oldData.pages.map((page) => {
            return {
              ...page,
              tweets: page.tweets.map((tweet: Tweet) => {
                if (tweet.id === id) {
                  return {
                    ...tweet,
                    likeCount: tweet.likeCount + countModifier,
                    likedByMe: addedLike,
                  };
                }
                return tweet;
              }),
            };
          }),
        };
      };
      // Call the function to update the infinite feed data
      trpcUtils.tweet.infiniteFeed.setInfiniteData({}, updateData);
      trpcUtils.tweet.infiniteFeed.setInfiniteData(
        { onlyFollowing: true },
        updateData
      );
      trpcUtils.tweet.infiteProfile.setInfiniteData(
        { userId: user.id },
        updateData
      );
    },
  });

  function handleToggleLike() {
    toggleLike.mutate({ id });
  }

  return (
    <li className="flex gap-4 border-b px-4 py-4">
      <Link href={`profiles/${user.id}`}>
        <ProfileImage src={user.image} />
      </Link>
      <div className="flex flex-grow flex-col">
        <div className="flex gap-1">
          <Link
            href={`profiles/${user.id}`}
            className="font-bold outline-none hover:underline focus-visible:underline"
          >
            {user.name}
          </Link>
          <span className="text-gray-500">-</span>
          <span className="text-gray-500">
            {dateTimeFormatter.format(createdAt)}
          </span>
        </div>
        <p className="whitespace-pre-wrap">{content}</p>
        <HeartButton
          onClick={handleToggleLike}
          isLoading={toggleLike.isPending}
          likedByMe={likedByMe}
          likeCount={likeCount}
        />
      </div>
    </li>
  );
}

type HeartButtonProps = {
  onClick: () => void;
  isLoading: boolean;
  likedByMe: boolean;
  likeCount: number;
};

function HeartButton({
  onClick,
  isLoading,
  likedByMe,
  likeCount,
}: HeartButtonProps) {
  // cek session user, if there login or no
  const session = useSession();

  /**
   * checks if "likedByMe" is true or false.
   * If "session" is null, shows "VscHeart"; otherwise, displays "VscHeartFilled".
   */
  const HeartIcon = likedByMe ? VscHeartFilled : VscHeart;

  if (session == null)
    return (
      <div className="mb-1 mt-1 flex items-center gap-3 self-start text-gray-500">
        <HeartIcon />
        <span>{likeCount}</span>
      </div>
    );

  return (
    <button
      type="button"
      disabled={isLoading}
      onClick={onClick}
      className={`group flex items-center gap-1 self-start transition-colors duration-200 ${
        // when hover will be text-red, and if not will be text-gray
        likedByMe
          ? "text-red-500"
          : "text-gray-500 hover:text-red-500 focus-visible:text-red-500"
      }`}
    >
      <IconHoverEffect red>
        <HeartIcon
          className={`transition-colors duration-200  ${
            likedByMe
              ? "text-red-500"
              : "group-hover:fil-red-500 fill-gray-500 group-focus-visible:fill-red-500"
          }`}
        />
      </IconHoverEffect>
      <span>{likeCount}</span>
    </button>
  );
}
