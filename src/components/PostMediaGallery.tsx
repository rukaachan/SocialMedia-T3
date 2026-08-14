import Image from "next/image";

export type PostMedia = {
  id: string;
  url: string;
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
  altText: string | null;
};

export default function PostMediaGallery({ media }: { media: PostMedia[] }) {
  if (media.length === 0) return null;

  return (
    <div
      className={`mt-3 grid gap-2 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 ${
        media.length === 1 ? "grid-cols-1" : "grid-cols-2"
      }`}
    >
      {media.map((item) => (
        <a
          key={item.id}
          href={item.url}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open image: ${item.altText ?? "Attached image"}`}
          className="group block overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          <Image
            src={item.url}
            alt={item.altText ?? "Attached image"}
            width={item.width}
            height={item.height}
            loading="lazy"
            sizes="(min-width: 768px) 560px, 100vw"
            className="h-auto max-h-[32rem] w-full object-contain transition-transform duration-200 group-hover:scale-[1.01]"
          />
        </a>
      ))}
    </div>
  );
}
