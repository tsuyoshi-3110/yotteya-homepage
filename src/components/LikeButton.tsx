"use client";
import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { Heart } from "lucide-react";

type LikeButtonProps = {
  postId: string;
  initialLikeCount?: number;
  /** 互換用（古い呼び出しで使っていた場合） */
  count?: number;
};

export default function LikeButton({
  postId,
  initialLikeCount,
  count, // 互換
}: LikeButtonProps) {
  const start = (count ?? initialLikeCount ?? 0);
  const [likeCount, setLikeCount] = useState(start);
  const [liked, setLiked] = useState(false);
  const [loading, setLoading] = useState(false);

  // 親からの値や postId 変更時に一旦リセット
  useEffect(() => {
    setLikeCount(start);
    setLiked(false);
  }, [postId, start]);

  // サーバーの現在値を取得
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const token = await auth.currentUser?.getIdToken().catch(() => null);
        const res = await fetch(`/api/posts/${postId}/like`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!mounted) return;
        if (typeof data.likeCount === "number") setLikeCount(data.likeCount);
        if (typeof data.liked === "boolean") setLiked(data.liked);
      } catch {
        // 失敗時は props ベースのまま
      }
    })();
    return () => {
      mounted = false;
    };
  }, [postId]);

  const toggle = async () => {
    const user = auth.currentUser;
    if (!user) {
      alert("ログインが必要です。");
      return;
    }
    if (loading) return;

    setLoading(true);
    const nextLiked = !liked;

    try {
      const token = await user.getIdToken();

      // 楽観更新（nextLiked を使う）
      setLiked(nextLiked);
      setLikeCount((c) => c + (nextLiked ? 1 : -1));

      const method = nextLiked ? "POST" : "DELETE";
      const res = await fetch(`/api/posts/${postId}/like`, {
        method,
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || "failed");

      if (typeof data.likeCount === "number") setLikeCount(data.likeCount);
      if (typeof data.liked === "boolean") setLiked(data.liked);
    } catch (e) {
      // ロールバック（nextLiked の逆に戻す）
      setLiked(!nextLiked);
      setLikeCount((c) => c + (nextLiked ? -1 : 1));
      console.error("いいね処理に失敗しました", e);
      alert("いいねできませんでした。もう一度お試しください。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1"
      disabled={loading}
      aria-pressed={liked}
      title={liked ? "いいねを取り消す" : "いいね"}
    >
      <Heart
        className={`h-5 w-5 transition-colors ${
          liked ? "text-pink-600 fill-pink-600" : "text-gray-400"
        }`}
        fill={liked ? "currentColor" : "none"}
      />
      <span className="text-sm">{likeCount}</span>
    </button>
  );
}
