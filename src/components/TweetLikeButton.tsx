"use client";

import { VscHeart, VscHeartFilled } from "react-icons/vsc";
import IconHoverEffect from "./IconHoverEffect";
import LoadingSpinner from "./LoadingSpinner";
import { useSession } from "~/lib/auth/client";

type TweetLikeButtonProps = {
  onClick: () => void;
  isLoading: boolean;
  likedByMe: boolean;
  likeCount: number;
  isError?: boolean;
};

export default function TweetLikeButton({
  onClick,
  isLoading,
  likedByMe,
  likeCount,
  isError = false,
}: TweetLikeButtonProps) {
  const session = useSession();
  const HeartIcon = likedByMe ? VscHeartFilled : VscHeart;

  if (session.status !== "authenticated") {
    return (
      <div className="mb-1 mt-1 flex items-center gap-3 self-start text-gray-500">
        <HeartIcon />
        <span>{likeCount}</span>
      </div>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={isLoading}
        onClick={onClick}
        aria-label={likedByMe ? "Unlike post" : "Like post"}
        className={`group flex items-center gap-1 self-start transition-colors duration-200 ${
          likedByMe ? "text-red-500" : "text-gray-500 hover:text-red-500 focus-visible:text-red-500"
        }`}
      >
        <IconHoverEffect red>
          <HeartIcon
            className={`transition-colors duration-200 ${
              likedByMe
                ? "text-red-500"
                : "group-hover:fil-red-500 fill-gray-500 group-focus-visible:fill-red-500"
            }`}
          />
        </IconHoverEffect>
        <span>{likeCount}</span>
        {isLoading && <LoadingSpinner />}
      </button>
      {isError && (
        <span role="alert" className="text-xs text-red-700">
          Could not update
        </span>
      )}
    </span>
  );
}
