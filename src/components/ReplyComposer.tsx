"use client";

import { useState, type FormEvent } from "react";
import Button from "./Button";
import { useSession } from "~/lib/auth/client";
import { api } from "~/utils/api";

type ApiContext = ReturnType<typeof api.useContext>;
type FeedUpdater = Parameters<ApiContext["tweet"]["infiniteFeed"]["setInfiniteData"]>[1];
type BookmarksUpdater = Parameters<ApiContext["bookmark"]["infiniteMine"]["setInfiniteData"]>[1];

export default function ReplyComposer({ parentId }: { parentId: string }) {
  const session = useSession();
  const profile = api.profile.getMe.useQuery(undefined, {
    enabled: session.status === "authenticated",
  });
  const trpcUtils = api.useContext();
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createReply = api.tweet.reply.useMutation({
    onSuccess: (reply) => {
      if (session.status !== "authenticated") return;
      const replyWithUser = {
        ...reply,
        isDeleted: false,
        deletedAt: null,
        likeCount: 0,
        likedByMe: false,
        bookmarkedByMe: false,
        replyCount: 0,
        user: {
          id: session.data.user.id,
          name: profile.data?.name ?? session.data.user.name ?? null,
          image: profile.data?.image ?? session.data.user.image ?? null,
        },
      };
      trpcUtils.tweet.infiniteReplies.setInfiniteData({ tweetId: parentId }, (oldData) => {
        if (oldData == null || oldData.pages[0] == null) return oldData;
        return {
          ...oldData,
          pages: [
            {
              ...oldData.pages[0],
              tweets: [replyWithUser, ...oldData.pages[0].tweets],
            },
            ...oldData.pages.slice(1),
          ],
        };
      });
      const incrementReplyCount: FeedUpdater = (oldData) => {
        if (oldData == null) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((page) => ({
            ...page,
            tweets: page.tweets.map((item) =>
              item.id === parentId ? { ...item, replyCount: item.replyCount + 1 } : item,
            ),
          })),
        };
      };
      trpcUtils.tweet.infiniteFeed.setInfiniteData({}, incrementReplyCount);
      trpcUtils.tweet.infiniteFeed.setInfiniteData({ onlyFollowing: true }, incrementReplyCount);
      trpcUtils.tweet.getById.setData({ id: parentId }, (oldData) =>
        oldData == null ? oldData : { ...oldData, replyCount: oldData.replyCount + 1 },
      );
      const incrementBookmarkReplyCount: BookmarksUpdater = (oldData) => {
        if (oldData == null) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((page) => ({
            ...page,
            tweets: page.tweets.map((item) =>
              item.id === parentId ? { ...item, replyCount: item.replyCount + 1 } : item,
            ),
          })),
        };
      };
      trpcUtils.bookmark.infiniteMine.setInfiniteData({}, incrementBookmarkReplyCount);
      void trpcUtils.tweet.infiteProfile.invalidate();
      setContent("");
      setError(null);
    },
    onError: (replyError) => {
      setError(replyError.message || "The reply could not be posted.");
    },
  });

  if (session.status !== "authenticated") {
    return <p className="border-b px-4 py-4 text-sm text-slate-600">Sign in to reply.</p>;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = content.trim();
    if (value.length === 0) {
      setError("Write a reply first.");
      return;
    }
    createReply.mutate({ parentId, content: value });
  }

  return (
    <form className="border-b px-4 py-4" onSubmit={handleSubmit}>
      <label className="sr-only" htmlFor="reply-content">
        Reply
      </label>
      <textarea
        id="reply-content"
        className="min-h-20 w-full resize-y rounded-xl border border-slate-300 p-3 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
        value={content}
        maxLength={500}
        placeholder="Write a reply…"
        disabled={createReply.isPending}
        onChange={(event) => setContent(event.target.value)}
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-xs text-slate-500">{content.length}/500</span>
        <Button type="submit" small disabled={createReply.isPending}>
          {createReply.isPending ? "Replying…" : "Reply"}
        </Button>
      </div>
      {error != null && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}
