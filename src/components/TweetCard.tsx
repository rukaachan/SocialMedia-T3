"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import PostMediaGallery, { type PostMedia } from "./PostMediaGallery";
import TweetLikeButton from "./TweetLikeButton";
import TweetBookmarkButton from "./TweetBookmarkButton";
import ProfileImage from "./ProfileImage";
import { useSession } from "~/lib/auth/client";
import { useTweetCardMutations } from "./useTweetCardMutations";

export type Tweet = {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  likeCount: number;
  likedByMe: boolean;
  bookmarkedByMe: boolean;
  replyCount: number;
  media: PostMedia[];
  parentId?: string | null;
  isDeleted?: boolean;
  deletedAt?: Date | null;
  threadId?: string;
  user: { id: string; image: string | null; name: string | null };
};

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "short",
});

export default function TweetCard({
  id,
  user,
  content,
  createdAt,
  updatedAt,
  likeCount,
  likedByMe,
  bookmarkedByMe,
  replyCount,
  media,
  threadId,
  isDeleted = false,
}: Tweet) {
  const session = useSession();
  const { toggleLike, updateTweet, deleteTweet } = useTweetCardMutations({
    id,
    userId: user.id,
    threadId,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(content);
  const isOwner = session.status === "authenticated" && session.data.user.id === user.id;

  function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextContent = editValue.trim();
    if (nextContent.length === 0) return;
    updateTweet.mutate({ id, content: nextContent }, { onSuccess: () => setIsEditing(false) });
  }

  function handleDelete() {
    if (typeof window !== "undefined" && !window.confirm("Delete this post?")) {
      return;
    }
    deleteTweet.mutate({ id });
  }

  return (
    <li className="flex gap-4 border-b px-4 py-4">
      <Link href={`/profiles/${user.id}`}>
        <ProfileImage src={user.image} />
      </Link>
      <div className="flex min-w-0 flex-grow flex-col">
        <div className="flex items-start gap-1">
          <div className="flex min-w-0 flex-grow flex-wrap gap-1">
            <Link
              href={`/profiles/${user.id}`}
              className="font-bold outline-none hover:underline focus-visible:underline"
            >
              {user.name}
            </Link>
            <span className="text-gray-500">-</span>
            <span className="text-gray-500">
              {dateTimeFormatter.format(createdAt)}
              {updatedAt.getTime() !== createdAt.getTime() && " · edited"}
            </span>
          </div>
          {isOwner && !isDeleted && (
            <div className="flex shrink-0 gap-2 text-xs text-slate-600">
              <button
                type="button"
                className="rounded px-1 py-0.5 underline hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                onClick={() => {
                  setEditValue(content);
                  setIsEditing(true);
                }}
                disabled={updateTweet.isPending || deleteTweet.isPending}
              >
                Edit
              </button>
              <button
                type="button"
                className="rounded px-1 py-0.5 underline hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                onClick={handleDelete}
                disabled={updateTweet.isPending || deleteTweet.isPending}
              >
                {deleteTweet.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          )}
        </div>

        {(updateTweet.isError || deleteTweet.isError) && (
          <p role="alert" className="mt-2 text-sm text-red-700">
            This post could not be changed. Try again.
          </p>
        )}
        {isDeleted ? (
          <p className="mt-2 italic text-slate-500">This post was deleted.</p>
        ) : isEditing ? (
          <form className="mt-2 space-y-2" onSubmit={handleEditSubmit}>
            <label className="sr-only" htmlFor={`edit-${id}`}>
              Edit post
            </label>
            <textarea
              id={`edit-${id}`}
              className="min-h-24 w-full resize-y rounded-xl border border-slate-300 p-2 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
              value={editValue}
              maxLength={500}
              autoFocus
              onChange={(event) => setEditValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setIsEditing(false);
              }}
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="rounded-full bg-slate-900 px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
                disabled={updateTweet.isPending || editValue.trim().length === 0}
              >
                {updateTweet.isPending ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                className="rounded-full border border-slate-300 px-3 py-1 text-sm"
                onClick={() => setIsEditing(false)}
                disabled={updateTweet.isPending}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            <p className="whitespace-pre-wrap">{content}</p>
            <PostMediaGallery media={media} />
          </>
        )}

        {!isDeleted && (
          <div className="mt-1 flex items-center gap-4">
            <TweetLikeButton
              onClick={() => toggleLike.mutate({ id })}
              isLoading={toggleLike.isPending}
              likedByMe={likedByMe}
              likeCount={likeCount}
              isError={toggleLike.isError}
            />
            <Link
              href={`/tweets/${id}`}
              className="rounded px-1 text-sm text-slate-500 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              {replyCount} {replyCount === 1 ? "reply" : "replies"}
            </Link>
            <TweetBookmarkButton
              tweetId={id}
              userId={user.id}
              threadId={threadId}
              bookmarkedByMe={bookmarkedByMe}
            />
          </div>
        )}
      </div>
    </li>
  );
}
