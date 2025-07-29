"use client";
import { useEffect, useRef, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  where,
  limit,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import PostCard, { Post } from "@/components/PostCard";
import PostForm from "@/components/PastForm";
import clsx from "clsx";


const LIMIT = 20;

export default function PostList() {
  /* ---------- state ---------- */
  const [posts, setPosts] = useState<Post[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [mineOnly, setMineOnly] = useState(false); // ★ 追加
  const [uid, setUid] = useState<string | null>(null);

  /* ---------- ログイン監視 ---------- */
  useEffect(() => auth.onAuthStateChanged((u) => setUid(u?.uid ?? null)), []);

  /* ---------- タイムライン購読 ---------- */
 useEffect(() => {
  if (mineOnly && !uid) return;  // ログイン前に mineOnly を押した場合ガード

  const base = collection(db, "posts");
  const q = mineOnly
    ? query(
        base,
        where("authorUid", "==", uid),
        orderBy("createdAt", "desc"),
        limit(LIMIT)              // ★ ここに追加
      )
    : query(
        base,
        orderBy("createdAt", "desc"),
        limit(LIMIT)              // ★ ここに追加
      );

  const unsub = onSnapshot(q, snap =>
    setPosts(
      snap.docs
        .map(d => ({ id: d.id, ...(d.data() as Omit<Post, "id">) }))
        .filter(p => p && p.id)
    )
  );
  return () => unsub();
}, [mineOnly, uid]);

  /* ---------- モーダル開閉時スクロール ---------- */
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (showForm && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [showForm]);

  /* ---------- JSX ---------- */
  return (
    <div className="mx-auto w-full max-w-xl px-4 pt-8 pb-28">
      {/* フィルタボタン */}
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setMineOnly(!mineOnly)}
          disabled={!uid}
          className={clsx(
            "rounded-full px-4 py-2 text-sm font-semibold transition",
            mineOnly
              ? "bg-purple-600 text-white hover:bg-purple-700"
              : "bg-gray-300 text-gray-800 hover:bg-gray-400",
            !uid && "opacity-40 cursor-not-allowed"
          )}
        >
          {mineOnly ? "全ての投稿を表示" : "自分の投稿だけ"}
        </button>
      </div>

      {/* 投稿カード一覧 */}
      <div className="grid grid-cols-1 gap-6">
        {posts.length === 0 ? (
          <p className="text-center text-sm text-gray-500">
            表示できる投稿がありません
          </p>
        ) : (
          posts.map((p) => <PostCard key={p.id} post={p} />)
        )}
      </div>

      {/* スクロールアンカー */}
      <div ref={bottomRef} />

      {/* ───── モーダル ───── */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowForm(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 text-center text-lg font-bold">新規投稿</h2>
            <PostForm />
            <button
              onClick={() => setShowForm(false)}
              className="mx-auto mt-4 block rounded-full bg-gray-500 px-6 py-2 text-sm text-white hover:bg-gray-600"
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      {/* 画面下部固定ボタン */}
      <button
        onClick={() => setShowForm(true)}
        className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full bg-green-500 px-8 py-3 text-base font-semibold text-white shadow-lg transition hover:bg-green-600"
      >
        ＋ 新しい投稿
      </button>
    </div>
  );
}
