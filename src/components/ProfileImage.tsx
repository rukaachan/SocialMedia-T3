import Image from "next/image";
import { VscAccount } from "react-icons/vsc";

type ProfileImageProps = {
  src?: string | null;
  alt?: string;
  className?: string;
};

export default function ProfileImage({
  src,
  alt = "Profile image",
  className = "",
}: ProfileImageProps) {
  return (
    <>
      <div className={`relative mt-2 h-12  w-12 overflow-hidden rounded-full ${className}`}>
        {src == null ? (
          <VscAccount className="h-full w-full" aria-hidden="true" />
        ) : (
          <Image src={src} alt={alt} quality={100} fill sizes="(min-width: 768px) 80px, 48px" />
        )}
      </div>
    </>
  );
}
