// src/components/ProductMedia.tsx
"use client";

import Image, { StaticImageData } from "next/image";
import clsx from "clsx";
import { useEffect, useRef, useState, useMemo, MouseEvent } from "react";
import { useOnScreen } from "@/lib/useOnScreen";

type Src = string | StaticImageData;
type MediaType = "image" | "video";

type MediaItem = {
  src: Src;
  type: MediaType;
};

interface Props {
  /** 互換用：単枚表示の src */
  src: Src;
  /** 互換用：単枚表示の type */
  type: MediaType;
  /** スライド用：画像1〜3枚 + 動画1つまで */
  items?: MediaItem[];

  className?: string;
  autoPlay?: boolean; // 既定: true（自動スライドON/OFF用）
  loop?: boolean; // ※未使用（動画は isSingleVideo で制御）
  muted?: boolean; // 既定: true（動画用）
  alt?: string;
  /** 一覧カードでは冒頭フレームを表示し、再生準備完了後に動画を流す */
  videoDisplay?: "play" | "thumbnailUntilReady";
  /** 動画読込中に即時表示するサムネイル画像 */
  videoPoster?: string;
  /** trueにすると aspect-square を外し、親要素を埋めるモードになる（背景用） */
  fill?: boolean;
}

/** items があればそれを優先。なければ旧来の単枚 src/type を1枚目として使う */
function normalizeItems(src: Src, type: MediaType, items?: MediaItem[]) {
  const MAX_IMAGES = 5;
  const MAX_VIDEOS = 1;

  const raw =
    Array.isArray(items) && items.length > 0 ? items : [{ src, type }];

  // 空srcなどを除外しつつ、画像5・動画1に制限（順序は維持）
  const out: MediaItem[] = [];
  let imgCount = 0;
  let vidCount = 0;

  for (const m of raw) {
    if (!m || !m.src) continue;

    if (m.type === "video") {
      if (vidCount >= MAX_VIDEOS) continue;
      vidCount += 1;
      out.push(m);
      continue;
    }

    // image
    if (imgCount >= MAX_IMAGES) continue;
    imgCount += 1;
    out.push(m);
  }

  return out.length > 0 ? out : [{ src, type }];
}

export default function ProductMedia({
  src,
  type,
  items,
  className = "",
  autoPlay = true,
  muted = true,
  alt = "",
  videoDisplay = "play",
  videoPoster,
  fill = false,
}: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [readyVideoIndexes, setReadyVideoIndexes] = useState<Set<number>>(
    () => new Set(),
  );
  // 画面に入る少し前からプリロードを始めたいので rootMargin を広めに
  const [ref, visible] = useOnScreen<HTMLDivElement>("600px");

  const slides = useMemo(
    () => normalizeItems(src, type, items),
    [src, type, items],
  );

  const total = slides.length || 1;
  const safeIndex = total === 0 ? 0 : ((currentIndex % total) + total) % total;
  const active = slides[safeIndex] ?? slides[0];

  const isVideoSlide = active.type === "video";
  const isSingleVideo = total === 1 && active.type === "video";

  // 全スライド分の video ref を持つ
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);

  /* =======================
     VIDEO 再生制御
     - 可視範囲 & アクティブな動画だけ再生
     - それ以外の動画は停止
  ======================= */
  useEffect(() => {
    videoRefs.current.forEach((video, index) => {
      if (!video) return;
      const slide = slides[index];

      if (
        (videoDisplay === "play" || readyVideoIndexes.has(index)) &&
        visible &&
        index === safeIndex &&
        slide?.type === "video"
      ) {
        const p = video.play();
        if (p && typeof p.catch === "function") {
          p.catch(() => {
            // モバイルの自動再生制限などは無視
          });
        }
      } else if (
        videoDisplay === "thumbnailUntilReady" &&
        visible &&
        slide?.type === "video" &&
        !readyVideoIndexes.has(index) &&
        video.readyState === 0 // HAVE_NOTHING: まだ何もロードされていない（iOS対応）
      ) {
        // iOS は preload を無視するため、可視になった時点で load() を呼んでメタデータを取得する
        video.load();
      } else {
        video.pause();
      }
    });
  }, [visible, safeIndex, slides, videoDisplay, readyVideoIndexes]);

  /* =======================
     自動スライド
     👉 動画がアクティブなときは動かさない
  ======================= */
  useEffect(() => {
    if (!autoPlay) return;
    if (total <= 1) return;
    if (isVideoSlide) return; // 動画スライド中は自動スライドしない

    const id = window.setInterval(() => {
      setCurrentIndex((prev) => {
        const next = prev + 1;
        if (total <= 0) return 0;
        return next >= total ? 0 : next;
      });
    }, 3500); // 3.5秒ごとにスライド

    return () => {
      window.clearInterval(id);
    };
  }, [autoPlay, total, isVideoSlide]);

  /* =======================
     ナビゲーション
  ======================= */
  const goTo = (idx: number) => {
    if (total <= 1) return;
    const next = ((idx % total) + total) % total;
    setCurrentIndex(next);
  };

  const handlePrev = (e: MouseEvent) => {
    e.stopPropagation();
    goTo(currentIndex - 1);
  };

  const handleNext = (e: MouseEvent) => {
    e.stopPropagation();
    goTo(currentIndex + 1);
  };

  const handleDotClick = (e: MouseEvent, idx: number) => {
    e.stopPropagation();
    goTo(idx);
  };

  // 動画再生が終わったら、ループしない場合は次のスライドへ
  const handleVideoEnded = () => {
    if (!autoPlay) return;
    if (total <= 1) return;
    goTo(currentIndex + 1);
  };

  const showVideoThumbnail = (video: HTMLVideoElement) => {
    if (videoDisplay !== "thumbnailUntilReady") return;
    video.pause();

    const previewTime =
      Number.isFinite(video.duration) && video.duration > 0
        ? Math.min(0.2, Math.max(0, video.duration / 20))
        : 0.2;

    try {
      video.currentTime = previewTime;
    } catch {
      // 一部ブラウザではseek可能になるまで少し待つため、先頭フレームを使う
    }
  };

  const markVideoReady = (index: number, video: HTMLVideoElement) => {
    if (videoDisplay !== "thumbnailUntilReady") return;

    setReadyVideoIndexes((previous) => {
      if (previous.has(index)) return previous;
      const next = new Set(previous);
      next.add(index);
      return next;
    });

    if (visible && index === safeIndex) {
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
          // ブラウザの自動再生制限時は静止サムネイルのまま表示する
        });
      }
    }
  };

  /* =======================
     スライダー表示
     - flex で横並び
     - translateX で左にスライド
     - 背景が一瞬見えないように連続表示
  ======================= */
  return (
    <div
      ref={ref}
      className={clsx(
        "relative w-full overflow-hidden",
        !fill && "aspect-square",
        fill && "h-full",
        className,
      )}
    >
      <div
        className={clsx(
          "flex h-full w-full",
          "transition-transform duration-500 ease-out", // ← 左にスライド＆右から出てくる
        )}
        style={{
          transform: `translateX(-${safeIndex * 100}%)`,
        }}
      >
        {slides.map((slide, index) => {
          const key =
            typeof slide.src === "string"
              ? slide.src
              : (slide.src as StaticImageData).src;

          return (
            <div
              key={key + index}
              className="relative w-full h-full flex-shrink-0"
            >
              {slide.type === "video" ? (
                <video
                  ref={(el) => {
                    videoRefs.current[index] = el;
                  }}
                  src={
                    typeof slide.src === "string"
                      ? slide.src
                      : (slide.src as StaticImageData).src
                  }
                  className="absolute inset-0 w-full h-full object-cover"
                  playsInline
                  muted={muted}
                  poster={videoPoster}
                  // 自動再生は useEffect 側で制御
                  autoPlay={false}
                  loop={isSingleVideo}
                  preload={visible ? "auto" : "metadata"}
                  onLoadedMetadata={(event) =>
                    showVideoThumbnail(event.currentTarget)
                  }
                  onCanPlay={(event) =>
                    markVideoReady(index, event.currentTarget)
                  }
                  onCanPlayThrough={(event) =>
                    markVideoReady(index, event.currentTarget)
                  }
                  onSeeked={(event) =>
                    markVideoReady(index, event.currentTarget)
                  }
                  onEnded={handleVideoEnded}
                />
              ) : (
                <Image
                  src={slide.src}
                  alt={alt}
                  fill
                  className="object-cover"
                  sizes="(min-width:1024px) 320px, (min-width:640px) 45vw, 90vw"
                  priority={false}
                  unoptimized
                />
              )}
            </div>
          );
        })}
      </div>

      {/* スライドナビ（画像・動画共通） */}
      {total > 1 && (
        <>
          <button
            type="button"
            onClick={handlePrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-100 rounded-full bg-black/40 text-white w-8 h-8 flex items-center justify-center text-lg"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-100 rounded-full bg-black/40 text-white w-8 h-8 flex items-center justify-center text-lg"
          >
            ›
          </button>
          <div className="absolute bottom-2 inset-x-0 flex justify-center gap-1 z-10">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={(e) => handleDotClick(e, i)}
                className={clsx(
                  "w-2 h-2 rounded-full transition-opacity",
                  i === safeIndex
                    ? "bg-white"
                    : "bg-white/50 hover:bg-white/80",
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
