import { MediaKind } from "@/types/company";
import NextImage from "next/image";

export default function InlineMediaViewer({
  url,
  type,
}: {
  url?: string | null;
  type?: MediaKind;
}) {
  if (!url) return null;
  return (
    <div className="px-6 md:px-8 pb-2">
      <div
        className="relative w-full overflow-hidden rounded border bg-black/5"
        style={{ aspectRatio: "1 / 1" }}
      >
        {type === "video" ? (
          <video
            src={url ?? undefined}
            className="absolute inset-0 h-full w-full object-cover"
            autoPlay
            muted
            playsInline
            loop
            controls
          />
        ) : (
          <NextImage
            src={url ?? ""}
            alt="company-hero"
            fill
            className="object-cover"
            sizes="100vw"
            priority
            unoptimized
          />
        )}
      </div>
    </div>
  );
}
