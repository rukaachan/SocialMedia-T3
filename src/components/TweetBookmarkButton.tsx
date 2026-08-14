"use client";

import { VscBookmark } from "react-icons/vsc";
import { api } from "~/utils/api";
import { useSession } from "~/lib/auth/client";

type TweetBookmarkButtonProps = {
  tweetId: string;
  bookmarkedByMe: boolean;
  userId: string;
  threadId?: string;
};

type ApiContext = ReturnType<typeof api.useContext>;
type FeedUpdater = Parameters<ApiContext["tweet"]["infiniteFeed"]["setInfiniteData"]>[1];
type RepliesUpdater = Parameters<ApiContext["tweet"]["infiniteReplies"]["setInfiniteData"]>[1];
type BookmarkUpdater = Parameters<ApiContext["bookmark"]["infiniteMine"]["setInfiniteData"]>[1];

export default function TweetBookmarkButton({
  tweetId,
  bookmarkedByMe,
  userId,
  threadId,
}: TweetBookmarkButtonProps) {
  const session = useSession();
  const trpcUtils = api.useContext();
  const toggleBookmark = api.bookmark.toggle.useMutation({
    onSuccess: ({ addedBookmark }) => {
      const updateFeed: FeedUpdater = (oldData) => {
        if (oldData == null) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((page) => ({
            ...page,
            tweets: page.tweets.map((item) =>
              item.id === tweetId ? { ...item, bookmarkedByMe: addedBookmark } : item,
            ),
          })),
        };
      };
      trpcUtils.tweet.infiniteFeed.setInfiniteData({}, updateFeed);
      trpcUtils.tweet.infiniteFeed.setInfiniteData({ onlyFollowing: true }, updateFeed);
      trpcUtils.tweet.infiteProfile.setInfiniteData({ userId }, updateFeed);

      if (threadId != null) {
        const updateReplies: RepliesUpdater = (oldData) => {
          if (oldData == null) return oldData;
          return {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              tweets: page.tweets.map((item) =>
                item.id === tweetId ? { ...item, bookmarkedByMe: addedBookmark } : item,
              ),
            })),
          };
        };
        trpcUtils.tweet.infiniteReplies.setInfiniteData({ tweetId: threadId }, updateReplies);
      } else {
        trpcUtils.tweet.getById.setData({ id: tweetId }, (oldData) =>
          oldData == null ? oldData : { ...oldData, bookmarkedByMe: addedBookmark },
        );
      }

      const updateBookmarks: BookmarkUpdater = (oldData) => {
        if (oldData == null || addedBookmark) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((page) => ({
            ...page,
            tweets: page.tweets.filter((item) => item.id !== tweetId),
          })),
        };
      };
      trpcUtils.bookmark.infiniteMine.setInfiniteData({}, updateBookmarks);
      if (addedBookmark) {
        void trpcUtils.bookmark.infiniteMine.invalidate({});
      }
    },
  });

  if (session.status !== "authenticated") return null;

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        className={`rounded-full p-1 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
          bookmarkedByMe
            ? "text-amber-600 hover:bg-amber-50"
            : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        }`}
        aria-label={bookmarkedByMe ? "Remove bookmark" : "Bookmark post"}
        aria-pressed={bookmarkedByMe}
        disabled={toggleBookmark.isPending}
        onClick={() => toggleBookmark.mutate({ tweetId })}
      >
        <VscBookmark aria-hidden="true" />
      </button>
      {toggleBookmark.isError && (
        <span role="alert" className="text-xs text-red-700">
          Could not save
        </span>
      )}
    </span>
  );
}
