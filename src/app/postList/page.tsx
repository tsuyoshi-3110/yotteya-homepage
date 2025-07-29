"use client";
import { useEffect, useRef, useState } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import PostCard, { Post } from "@/components/PostCard";
import PostForm from "@/components/PastForm";
export default function PostList() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [showForm, setShowForm] = useState(false);

  /* ----- タイムライン購読 ----- */
  useEffect(() => {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, snap =>
      setPosts(
        snap.docs
          .map(d => ({ id: d.id, ...(d.data() as Omit<Post, "id">) }))
          .filter(p => p && p.id)
      )
    );
    return () => unsub();
  }, []);

  /* ----- ページ末尾へのスクロール ----- */
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (showForm && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [showForm]);

  /* ---------- JSX ---------- */
  return (
    <div className="w-full max-w-xl mx-auto px-4 pt-8 pb-28">
      {/* 投稿カード一覧 */}
      <div className="grid grid-cols-1 gap-6">
        {posts.map(p => (
          <PostCard key={p.id} post={p} />
        ))}
      </div>

      {/* スクロールアンカー */}
      <div ref={bottomRef} />

      {/* ───── モーダル ───── */}
      {showForm && (
        <div
          className="
            fixed inset-0 z-50 flex items-center justify-center
            bg-black/50 backdrop-blur-sm
          "
          onClick={() => setShowForm(false)}        /* 背景クリックで閉じる */
        >
          <div
            className="w-full max-w-lg bg-white rounded-xl p-6 shadow-xl"
            onClick={e => e.stopPropagation()}      /* モーダル内クリック無効 */
          >
            <h2 className="text-lg font-bold mb-4 text-center">新規投稿</h2>
            <PostForm />
            <button
              onClick={() => setShowForm(false)}
              className="
                mt-4 mx-auto block
                rounded-full bg-gray-500
                px-6 py-2 text-white text-sm
                hover:bg-gray-600 transition
              "
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      {/* 画面下部固定ボタン */}
      <button
        onClick={() => setShowForm(true)}
        className="
          fixed bottom-4 left-1/2 -translate-x-1/2
          rounded-full bg-green-500
          px-8 py-3 text-base font-semibold text-white
          shadow-lg hover:bg-green-600 transition
          z-40
        "
      >
        ＋ 新しい投稿
      </button>
    </div>
  );
}
