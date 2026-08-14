"use client";

import { api } from "~/utils/api";

type MutationOptions = {
  id: string;
  userId: string;
  threadId?: string;
};

type ApiContext = ReturnType<typeof api.useContext>;
type CacheUpdater = Parameters<ApiContext["tweet"]["infiniteFeed"]["setInfiniteData"]>[1];
type RepliesUpdater = Parameters<ApiContext["tweet"]["infiniteReplies"]["setInfiniteData"]>[1];
type BookmarksUpdater = Parameters<ApiContext["bookmark"]["infiniteMine"]["setInfiniteData"]>[1];

function updateTweetCaches(trpcUtils: ApiContext, userId: string, updater: CacheUpdater) {
  trpcUtils.tweet.infiniteFeed.setInfiniteData({}, updater);
  trpcUtils.tweet.infiniteFeed.setInfiniteData({ onlyFollowing: true }, updater);
  trpcUtils.tweet.infiteProfile.setInfiniteData({ userId }, updater);
}

function updateReplyCache(trpcUtils: ApiContext, threadId: string, updater: RepliesUpdater) {
  trpcUtils.tweet.infiniteReplies.setInfiniteData({ tweetId: threadId }, updater);
}

export function useTweetCardMutations({ id, userId, threadId }: MutationOptions) {
  const trpcUtils = api.useContext();

  const toggleLike = api.tweet.toggleLike.useMutation({
    onSuccess: ({ addedLike }) => {
      const countModifier = addedLike ? 1 : -1;
      const updateData: CacheUpdater = (oldData) => {
        if (oldData == null) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((page) => ({
            ...page,
            tweets: page.tweets.map((item) =>
              item.id === id
                ? {
                    ...item,
                    likeCount: item.likeCount + countModifier,
                    likedByMe: addedLike,
                  }
                : item,
            ),
          })),
        };
      };
      updateTweetCaches(trpcUtils, userId, updateData);

      if (threadId != null) {
        const replyUpdate: RepliesUpdater = (oldData) => {
          if (oldData == null) return oldData;
          return {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              tweets: page.tweets.map((item) =>
                item.id === id
                  ? {
                      ...item,
                      likeCount: item.likeCount + countModifier,
                      likedByMe: addedLike,
                    }
                  : item,
              ),
            })),
          };
        };
        updateReplyCache(trpcUtils, threadId, replyUpdate);
      } else {
        trpcUtils.tweet.getById.setData({ id }, (oldData) =>
          oldData == null
            ? oldData
            : {
                ...oldData,
                likeCount: oldData.likeCount + countModifier,
                likedByMe: addedLike,
              },
        );
      }
    },
  });

  const updateTweet = api.tweet.update.useMutation({
    onSuccess: (updated) => {
      const updateData: CacheUpdater = (oldData) => {
        if (oldData == null) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((page) => ({
            ...page,
            tweets: page.tweets.map((item) =>
              item.id === id
                ? {
                    ...item,
                    content: updated.content,
                    updatedAt: updated.updatedAt,
                  }
                : item,
            ),
          })),
        };
      };
      updateTweetCaches(trpcUtils, userId, updateData);

      if (threadId != null) {
        const replyUpdate: RepliesUpdater = (oldData) => {
          if (oldData == null) return oldData;
          return {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              tweets: page.tweets.map((item) =>
                item.id === id
                  ? { ...item, content: updated.content, updatedAt: updated.updatedAt }
                  : item,
              ),
            })),
          };
        };
        updateReplyCache(trpcUtils, threadId, replyUpdate);
      } else {
        trpcUtils.tweet.getById.setData({ id }, (oldData) =>
          oldData == null
            ? oldData
            : {
                ...oldData,
                content: updated.content,
                updatedAt: updated.updatedAt,
              },
        );
      }
    },
  });

  const deleteTweet = api.tweet.delete.useMutation({
    onSuccess: (deleted) => {
      const removeData: CacheUpdater = (oldData) => {
        if (oldData == null) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((page) => ({
            ...page,
            tweets: page.tweets.filter((item) => item.id !== id),
          })),
        };
      };
      updateTweetCaches(trpcUtils, userId, removeData);
      const removeBookmark: BookmarksUpdater = (oldData) => {
        if (oldData == null) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((page) => ({
            ...page,
            tweets: page.tweets.filter((item) => item.id !== id),
          })),
        };
      };
      trpcUtils.bookmark.infiniteMine.setInfiniteData({}, removeBookmark);

      if (threadId != null) {
        const replyUpdate: RepliesUpdater = (oldData) => {
          if (oldData == null) return oldData;
          return {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              tweets: page.tweets.map((item) =>
                item.id === id
                  ? {
                      ...item,
                      content: "",
                      media: [],
                      isDeleted: true,
                      deletedAt: deleted.deletedAt,
                      updatedAt: deleted.updatedAt,
                    }
                  : item,
              ),
            })),
          };
        };
        updateReplyCache(trpcUtils, threadId, replyUpdate);
      } else {
        trpcUtils.tweet.getById.setData({ id }, (oldData) =>
          oldData == null
            ? oldData
            : {
                ...oldData,
                content: "",
                media: [],
                isDeleted: true,
                deletedAt: deleted.deletedAt,
                updatedAt: deleted.updatedAt,
              },
        );
      }
    },
  });

  return { toggleLike, updateTweet, deleteTweet };
}
