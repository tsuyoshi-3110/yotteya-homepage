"use client";

import { useEffect, useMemo, useState } from "react";
import { useThemeGradient } from "@/lib/useThemeGradient";
import { THEMES, ThemeKey } from "@/lib/themes";

type Review = {
  author: string;
  rating: number;
  text: string;
  time?: string;
  profilePhotoUrl?: string;
};

type ApiShape = {
  reviews?: Array<{
    author?: string;
    author_name?: string;
    rating?: number;
    text?: string;
    original_text?: string;
    relative_time_description?: string;
    profile_photo_url?: string;
  }>;
  rating?: number | null;
  total?: number | null;
  error?: string;
};

/* ---------------- 画像URL・テキストの正規化 ---------------- */
function normalizeReviews(list: ApiShape["reviews"] | undefined): Review[] {
  if (!Array.isArray(list)) return [];
  const fixUrl = (u?: string) => {
    if (!u) return undefined;
    let out = u.trim();
    if (!out) return undefined;
    if (out.startsWith("//")) out = "https:" + out;
    if (out.startsWith("http://")) out = out.replace("http://", "https://");
    try {
      const url = new URL(out);
      if (url.hostname.endsWith("googleusercontent.com") && !url.searchParams.has("sz")) {
        url.searchParams.set("sz", "64");
        out = url.toString();
      }
    } catch {}
    return out;
  };

  return list.map((r) => {
    const text = (r?.text ?? "").trim() || (r?.original_text ?? "").trim() || "";
    return {
      author: (r?.author ?? r?.author_name ?? "").trim() || "匿名ユーザー",
      rating: typeof r?.rating === "number" ? r!.rating : 0,
      text,
      time: r?.relative_time_description,
      profilePhotoUrl: fixUrl(r?.profile_photo_url),
    };
  });
}

/* ---------------- Avatar（ローカル定義） ---------------- */
function Avatar({ author, url }: { author: string; url?: string }) {
  const initial = (author || "？").trim().charAt(0);
  return (
    <div className="relative">
      {url ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt=""
            className="h-8 w-8 rounded-full object-cover"
            referrerPolicy="no-referrer"
            loading="lazy"
            onError={(e) => {
              // 画像失敗時は非表示→直後のフォールバックを表示
              e.currentTarget.style.display = "none";
              const sib = e.currentTarget.nextElementSibling as HTMLElement | null;
              if (sib) sib.style.display = "flex";
            }}
          />
          <div className="hidden h-8 w-8 rounded-full bg-gray-400 text-white text-sm font-semibold items-center justify-center">
            {initial}
          </div>
        </>
      ) : (
        <div className="h-8 w-8 rounded-full bg-gray-400 text-white text-sm font-semibold flex items-center justify-center">
          {initial}
        </div>
      )}
    </div>
  );
}

/* ---------------- 本体 ---------------- */
export default function StoreReviews({
  placeId,
  googleEnabled,
}: {
  placeId: string;
  /** 連携がONのときだけ読み込み・表示する */
  googleEnabled: boolean;
}) {
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [avg, setAvg] = useState<number | null>(null);
  const [loading, setLoading] = useState(false); // ← オフ時は起動しないので初期 false
  const [error, setError] = useState<string | null>(null);

  // テーマが暗いか判定
  const gradient = useThemeGradient();
  const isDark = useMemo(() => {
    const darks: ThemeKey[] = ["brandG", "brandH", "brandI"];
    return !!gradient && darks.some((k) => gradient === THEMES[k]);
  }, [gradient]);

  useEffect(() => {
    // 連携OFFのときは一切フェッチしない & 状態もリセット
    if (!googleEnabled) {
      setReviews(null);
      setTotal(null);
      setAvg(null);
      setLoading(false);
      setError(null);
      return;
    }

    let aborted = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const r = await fetch(
          `/api/place-reviews?placeId=${encodeURIComponent(placeId)}&lang=ja`,
          { cache: "no-store" }
        );
        const j: ApiShape = await r.json();
        if (!r.ok) throw new Error(j?.error || "places error");
        if (!aborted) {
          setReviews(normalizeReviews(j.reviews));
          setTotal(typeof j.total === "number" ? j.total : null);
          setAvg(typeof j.rating === "number" ? j.rating : null);
        }
      } catch (e: any) {
        if (!aborted) setError(e?.message || "places error");
      } finally {
        if (!aborted) setLoading(false);
      }
    })();
    return () => {
      aborted = true;
    };
  }, [placeId, googleEnabled]);

  // 連携OFFのときは非表示（DOMごと描画しない）
  if (!googleEnabled) return null;

  if (loading) return <p>読み込み中...</p>;
  if (error) return <p className="text-red-500">エラー: {error}</p>;
  if (!reviews || reviews.length === 0)
    return (
      <div className="mt-3 rounded-md border bg-transparent p-4 text-sm">
        口コミはまだありません
      </div>
    );

  return (
    <div className="space-y-4">
      {/* ヘッダ */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold">口コミ</span>
          {typeof avg === "number" && (
            <span className="text-yellow-500" aria-label={`平均評価 ${avg} 点`}>
              {"★".repeat(Math.round(avg))}
            </span>
          )}
          {typeof total === "number" && (
            <span className="text-sm opacity-70">（{total}件）</span>
          )}
        </div>
        <a
          href={`https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(
            placeId
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm underline text-blue-600"
        >
          Googleで口コミを見る
        </a>
      </div>

      {reviews.map((rv, i) => (
        <div
          key={i}
          className={`rounded-md border p-4 shadow-sm ${
            isDark ? "bg-black/40 text-white" : "bg-white/70 text-gray-800"
          }`}
        >
          <div className="flex items-center gap-3 mb-2">
            <Avatar author={rv.author} url={rv.profilePhotoUrl} />
            <div className="flex-1">
              <div className="font-medium">{rv.author}</div>
              <div className="flex items-center gap-2 text-xs opacity-70">
                <span className="text-yellow-500" aria-label={`評価 ${rv.rating} 点`}>
                  {"★".repeat(Math.round(rv.rating)) || "★"}
                </span>
                {rv.time && <span>{rv.time}</span>}
              </div>
            </div>
          </div>
          <p className="text-sm whitespace-pre-wrap">
            {rv.text || "（コメントなし）"}
          </p>
        </div>
      ))}
    </div>
  );
}
