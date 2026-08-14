"use client";

import { useEffect, useState, type FormEvent } from "react";
import Button from "~/components/Button";
import ProfileImage from "~/components/ProfileImage";
import { MAX_MEDIA_BYTES } from "~/lib/media/constants";
import { api } from "~/utils/api";
import { useSession } from "~/lib/auth/client";

export default function ProfileEditor() {
  const session = useSession();
  const profile = api.profile.getMe.useQuery(undefined, {
    enabled: session.status === "authenticated",
  });
  const trpcUtils = api.useContext();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (profile.data == null) return;
    setName(profile.data.name ?? "");
    setBio(profile.data.bio ?? "");
  }, [profile.data]);

  useEffect(() => {
    return () => {
      if (previewUrl != null) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function uploadAvatar(file: File) {
    const formData = new FormData();
    formData.set("purpose", "avatar");
    formData.set("file", file);

    const response = await fetch("/api/media/upload", {
      method: "POST",
      body: formData,
    });
    const payload = (await response.json().catch(() => null)) as {
      id?: string;
      error?: string;
    } | null;

    if (!response.ok || payload?.id == null) {
      throw new Error(payload?.error ?? "The avatar could not be uploaded.");
    }

    return payload.id;
  }

  function handleAvatarChange(file: File | undefined) {
    if (file == null) return;
    setError(null);
    setSuccess(null);

    if (!file.type.startsWith("image/")) {
      setError("Choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > MAX_MEDIA_BYTES) {
      setError("Images must be 5 MB or smaller.");
      return;
    }

    setAvatarFile(file);
    setRemoveAvatar(false);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function handleRemoveAvatar() {
    setAvatarFile(null);
    setPreviewUrl(null);
    setRemoveAvatar(true);
    setError(null);
    setSuccess(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSaving(true);

    let avatarMediaId: string | undefined;
    try {
      if (avatarFile != null) {
        avatarMediaId = await uploadAvatar(avatarFile);
      }

      const updated = await updateProfile.mutateAsync({
        name,
        bio,
        avatarMediaId,
        removeAvatar,
      });
      await trpcUtils.profile.getMe.cancel();
      trpcUtils.profile.getMe.setData(undefined, updated);
      if (session.status === "authenticated") {
        trpcUtils.profile.getById.setData({ id: session.data.user.id }, updated);
        void trpcUtils.tweet.infiniteFeed.invalidate();
        void trpcUtils.tweet.infiniteFeed.invalidate({ onlyFollowing: true });
        void trpcUtils.tweet.infiteProfile.invalidate({ userId: session.data.user.id });
      }
      setAvatarFile(null);
      setPreviewUrl(null);
      setRemoveAvatar(false);
      setSuccess("Profile saved.");
    } catch (saveError) {
      if (avatarMediaId != null) {
        await fetch("/api/media/abort", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ids: [avatarMediaId] }),
        }).catch(() => undefined);
      }
      setError(saveError instanceof Error ? saveError.message : "The profile could not be saved.");
    } finally {
      setIsSaving(false);
    }
  }

  const updateProfile = api.profile.updateMe.useMutation();
  const currentImage = previewUrl ?? profile.data?.image ?? null;

  if (profile.isLoading) {
    return <p className="text-sm text-slate-600">Loading profile…</p>;
  }

  if (profile.isError || profile.data == null) {
    return (
      <p role="alert" className="text-sm text-red-700">
        Profile settings are unavailable right now.
      </p>
    );
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Your profile</h2>
        <p className="mt-1 text-sm text-slate-600">
          Choose how your name, bio, and avatar appear to other people.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <ProfileImage
          src={currentImage}
          alt={name.length > 0 ? `${name} avatar` : "Profile avatar"}
          className="mt-0 h-20 w-20"
        />
        <div className="space-y-2">
          <label className="inline-flex cursor-pointer rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-slate-900">
            Choose avatar
            <input
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => handleAvatarChange(event.target.files?.[0])}
            />
          </label>
          {(profile.data.hasCustomAvatar || avatarFile != null) && (
            <button
              type="button"
              className="block text-sm text-slate-600 underline hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
              onClick={handleRemoveAvatar}
            >
              Remove custom avatar
            </button>
          )}
          <p className="text-xs text-slate-500">JPEG, PNG, or WebP up to 5 MB.</p>
        </div>
      </div>

      <label className="block text-sm font-medium text-slate-700">
        Display name
        <input
          className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
          value={name}
          maxLength={50}
          required
          onChange={(event) => setName(event.target.value)}
        />
      </label>

      <label className="block text-sm font-medium text-slate-700">
        Bio
        <textarea
          className="mt-1 block min-h-24 w-full resize-y rounded-xl border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
          value={bio}
          maxLength={160}
          onChange={(event) => setBio(event.target.value)}
        />
        <span className="mt-1 block text-xs text-slate-500">{bio.length}/160 characters</span>
      </label>

      {error != null && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {success != null && (
        <p role="status" className="text-sm text-green-700" aria-live="polite">
          {success}
        </p>
      )}

      <Button type="submit" disabled={isSaving}>
        {isSaving ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}
