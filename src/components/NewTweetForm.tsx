"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import Button from "./Button";
import PostMediaPicker, { type SelectedPostImage } from "./PostMediaPicker";
import ProfileImage from "./ProfileImage";
import { useAutoResizeTextArea } from "~/hooks/useAutoResizeTextArea";
import { useSession } from "~/lib/auth/client";
import { api } from "~/utils/api";

export default function NewTweetForm() {
  const session = useSession();

  if (session.status !== "authenticated") return null;

  return <Form />;
}

async function abortMediaUploads(ids: string[]) {
  if (ids.length === 0) return;
  await fetch("/api/media/abort", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ids }),
  }).catch(() => undefined);
}

function Form() {
  const session = useSession();
  const profile = api.profile.getMe.useQuery(undefined, {
    enabled: session.status === "authenticated",
  });
  const [inputValue, setInputValue] = useState("");
  const [media, setMedia] = useState<SelectedPostImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useAutoResizeTextArea(inputValue);
  const trpcUtils = api.useContext();

  const createTweet = api.tweet.create.useMutation({
    onSuccess: (newTweet) => {
      setInputValue("");
      for (const image of media) URL.revokeObjectURL(image.previewUrl);
      setMedia([]);
      setError(null);

      if (session.status !== "authenticated") return;

      const newCatchTweet = {
        ...newTweet,
        likeCount: 0,
        likedByMe: false,
        bookmarkedByMe: false,
        replyCount: 0,
        user: {
          id: session.data.user.id,
          name: session.data.user.name || null,
          image: profile.data?.image ?? session.data.user.image ?? null,
        },
      };
      const updateData: Parameters<typeof trpcUtils.tweet.infiniteFeed.setInfiniteData>[1] = (
        oldData,
      ) => {
        if (oldData == null || oldData.pages[0] == null) return oldData;

        return {
          ...oldData,
          pages: [
            {
              ...oldData.pages[0],
              tweets: [newCatchTweet, ...oldData.pages[0].tweets],
            },
            ...oldData.pages.slice(1),
          ],
        };
      };

      trpcUtils.tweet.infiniteFeed.setInfiniteData({}, updateData);
      trpcUtils.tweet.infiniteFeed.setInfiniteData({ onlyFollowing: true }, updateData);
      trpcUtils.tweet.infiteProfile.setInfiniteData({ userId: session.data.user.id }, updateData);
    },
  });

  async function uploadImage(image: SelectedPostImage) {
    const formData = new FormData();
    formData.set("purpose", "post");
    formData.set("altText", image.altText.trim());
    formData.set("file", image.file);

    const response = await fetch("/api/media/upload", {
      method: "POST",
      body: formData,
    });
    const payload = (await response.json().catch(() => null)) as {
      id?: string;
      error?: string;
    } | null;

    if (!response.ok || payload?.id == null) {
      throw new Error(payload?.error ?? "An image could not be uploaded.");
    }

    return payload.id;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (session.status !== "authenticated") return;

    const content = inputValue.trim();
    if (content.length === 0) {
      setError("Add some text before posting.");
      return;
    }
    if (media.some((image) => image.altText.trim().length === 0)) {
      setError("Add alt text to every image.");
      return;
    }

    setError(null);
    setIsUploading(media.length > 0);
    const uploadedIds: string[] = [];

    try {
      for (const image of media) {
        uploadedIds.push(await uploadImage(image));
      }
      await createTweet.mutateAsync({ content, mediaIds: uploadedIds });
    } catch (submitError) {
      await abortMediaUploads(uploadedIds);
      setError(
        submitError instanceof Error ? submitError.message : "The post could not be created.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  if (session.status !== "authenticated") return null;
  const isBusy = isUploading || createTweet.isPending;

  return (
    <form className="flex flex-col gap-2 border-b px-4" onSubmit={handleSubmit} aria-busy={isBusy}>
      <div className="flex gap-4">
        <ProfileImage src={profile.data?.image ?? session.data?.user?.image} />
        <textarea
          ref={inputRef}
          style={{ height: 0 }}
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          className="flex-grow resize-none overflow-hidden p-4 text-lg outline-none"
          placeholder="What's happening?"
          aria-label="Post text"
          maxLength={500}
          disabled={isBusy}
        />
      </div>
      <PostMediaPicker value={media} onChange={setMedia} disabled={isBusy} />
      {error != null && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <Button type="submit" className="my-2 self-end" disabled={isBusy}>
        {isUploading ? "Uploading…" : createTweet.isPending ? "Posting…" : "Tweet"}
      </Button>
    </form>
  );
}
