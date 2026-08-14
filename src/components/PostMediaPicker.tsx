"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_CLIENT_MEDIA_DIMENSION, MAX_MEDIA_BYTES } from "~/lib/media/constants";

export type SelectedPostImage = {
  id: string;
  file: File;
  altText: string;
  previewUrl: string;
};

type PostMediaPickerProps = {
  value: SelectedPostImage[];
  onChange: (images: SelectedPostImage[]) => void;
  disabled?: boolean;
};

const MAX_POST_IMAGES = 4;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function createId() {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

function revokePreviews(images: SelectedPostImage[]) {
  for (const image of images) URL.revokeObjectURL(image.previewUrl);
}

export default function PostMediaPicker({
  value,
  onChange,
  disabled = false,
}: PostMediaPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const valueRef = useRef(value);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  valueRef.current = value;

  useEffect(() => {
    return () => {
      for (const image of valueRef.current) URL.revokeObjectURL(image.previewUrl);
    };
  }, []);

  function commitImages(images: SelectedPostImage[]) {
    onChange([...value, ...images]);
    if (inputRef.current != null) inputRef.current.value = "";
  }

  async function normalizeImage(file: File) {
    if (typeof createImageBitmap !== "function") return file;

    let bitmap: ImageBitmap | null = null;
    try {
      bitmap = await createImageBitmap(file);
      const longestEdge = Math.max(bitmap.width, bitmap.height);
      if (longestEdge <= MAX_CLIENT_MEDIA_DIMENSION) return file;

      const scale = MAX_CLIENT_MEDIA_DIMENSION / longestEdge;
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (context == null) return file;
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, file.type, 0.9),
      );
      if (blob == null) return file;
      return new File([blob], file.name, {
        type: file.type,
        lastModified: file.lastModified,
      });
    } catch {
      return file;
    } finally {
      bitmap?.close();
    }
  }

  function handleFiles(files: FileList | null) {
    if (files == null || files.length === 0 || isProcessing) return;
    setError(null);

    const incoming = Array.from(files);
    if (value.length + incoming.length > MAX_POST_IMAGES) {
      setError(`Posts can include up to ${MAX_POST_IMAGES} images.`);
      return;
    }

    const next: SelectedPostImage[] = [];
    for (const file of incoming) {
      if (!ACCEPTED_TYPES.has(file.type)) {
        revokePreviews(next);
        setError("Use JPEG, PNG, or WebP images.");
        return;
      }
      if (file.size > MAX_MEDIA_BYTES) {
        revokePreviews(next);
        setError("Each image must be 5 MB or smaller.");
        return;
      }
      next.push({
        id: createId(),
        file,
        altText: "",
        previewUrl: URL.createObjectURL(file),
      });
    }

    if (typeof createImageBitmap !== "function") {
      commitImages(next);
      return;
    }

    setIsProcessing(true);
    void Promise.all(
      next.map(async (image) => ({ ...image, file: await normalizeImage(image.file) })),
    )
      .then((normalized) => commitImages(normalized))
      .catch(() => {
        revokePreviews(next);
        setError("The images could not be prepared. Try again.");
      })
      .finally(() => setIsProcessing(false));
  }

  function removeImage(id: string) {
    const removed = value.find((image) => image.id === id);
    if (removed != null) URL.revokeObjectURL(removed.previewUrl);
    onChange(value.filter((image) => image.id !== id));
    setError(null);
  }

  function updateAltText(id: string, altText: string) {
    onChange(value.map((image) => (image.id === id ? { ...image, altText } : image)));
  }

  return (
    <div className="space-y-3" aria-busy={isProcessing}>
      <label className="inline-flex cursor-pointer items-center rounded-full border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-slate-900">
        {isProcessing ? "Preparing images…" : "Add images"}
        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={disabled || isProcessing || value.length >= MAX_POST_IMAGES}
          onChange={(event) => handleFiles(event.target.files)}
        />
      </label>
      <span className="ml-2 text-xs text-slate-500">
        {value.length}/{MAX_POST_IMAGES}
      </span>

      {value.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {value.map((image, index) => (
            <div key={image.id} className="space-y-2">
              <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                {/* Blob previews are local and cannot be passed through Next Image. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.previewUrl}
                  alt={image.altText || `Selected image ${index + 1}`}
                  width={240}
                  height={240}
                  className="aspect-square w-full object-contain"
                />
                <button
                  type="button"
                  className="absolute right-1 top-1 rounded-full bg-white/90 px-2 py-1 text-xs font-medium text-slate-800 shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                  onClick={() => removeImage(image.id)}
                  disabled={disabled || isProcessing}
                  aria-label={`Remove image ${index + 1}`}
                >
                  Remove
                </button>
              </div>
              <label className="block text-xs font-medium text-slate-700">
                Alt text
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-900 focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                  value={image.altText}
                  maxLength={200}
                  required
                  disabled={disabled}
                  placeholder="Describe this image"
                  onChange={(event) => updateAltText(image.id, event.target.value)}
                />
              </label>
            </div>
          ))}
        </div>
      )}

      {error != null && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
