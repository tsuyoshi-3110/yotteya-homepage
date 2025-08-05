"use client";

import { useEffect, useState, useCallback } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import CardSpinner from "./CardSpinner";
import { useThemeGradient } from "@/lib/useThemeGradient";
import { motion, AnimatePresence } from "framer-motion";

export default function AboutClient() {
  const [content, setContent] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [editing, setEditing] = useState<boolean>(false);
  const [draft, setDraft] = useState<string>("");
  const [submitFlag, setSubmitFlag] = useState(false);

  const [keywords, setKeywords] = useState(["", "", ""]);
  const [loading, setLoading] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [contentLoading, setContentLoading] = useState(true);

  const nonEmptyKeywords = keywords.filter((k) => k.trim() !== "");

  const gradient = useThemeGradient();
  const SITE_KEY = "yotteya";
  const docRef = doc(db, "sitePages", SITE_KEY, "pages", "about");

  // 管理者判定
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => setIsAdmin(!!user));
    return () => unsub();
  }, []);

  // 初期読込
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const text = snap.data().text ?? "";
          setContent(text);
          setDraft(text);
        }
      } finally {
        setContentLoading(false);
      }
    })();
  }, [docRef]);

  const handleSave = useCallback(async () => {
    setSubmitFlag(true);
    try {
      await setDoc(docRef, { text: draft });
      setContent(draft);
      setEditing(false);
      setKeywords(["", "", ""]);
      alert("保存しました！");
    } finally {
      setSubmitFlag(false);
    }
  }, [docRef, draft]);

  if (!gradient) return <CardSpinner />;

  return (
    <main className="relative max-w-3xl mx-auto px-4 py-10">
      {/* 背景の淡いグラデーション（控えめ） */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/10 via-white/30 to-rose-50 rounded-md" />
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-indigo-200/20 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-rose-200/20 blur-3xl" />
      </div>

      {/* 本文カード（グラス・モーフィズム風） */}
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur-md shadow-lg"
      >
        <div className="p-5">
          {contentLoading ? (
            // ローディング時のスケルトン
            <div className="space-y-3 animate-pulse">
              <div className="h-4 rounded bg-gray-200/70 w-5/6" />
              <div className="h-4 rounded bg-gray-200/70 w-11/12" />
              <div className="h-4 rounded bg-gray-200/70 w-3/4" />
              <div className="h-4 rounded bg-gray-200/70 w-2/3" />
            </div>
          ) : (
            <motion.div
              key={content} // 保存後もアニメを効かせる
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="leading-relaxed whitespace-pre-wrap prose prose-neutral max-w-none"
            >
              {content || "ただいま準備中です。"}
            </motion.div>
          )}

          {/* 編集ボタン */}
          {isAdmin && !editing && (
            <motion.div
              className="mt-5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <Button
                onClick={() => setEditing(true)}
                className="bg-blue-600 hover:bg-blue-700 transition-colors shadow"
                asChild={false}
              >
                <span>編集する</span>
              </Button>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* ===== 編集モーダル ===== */}
      <AnimatePresence>
        {isAdmin && editing && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Overlay */}
            <motion.div
              className="absolute inset-0 bg-black/50"
              aria-hidden
              onClick={() => setEditing(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            {/* Dialog */}
            <motion.div
              role="dialog"
              aria-modal="true"
              className="relative w-full max-w-2xl mx-4 rounded-2xl bg-white/30 shadow-2xl p-6 space-y-4"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
            >
              <h2 className="text-xl font-bold text-center">内容を編集</h2>

              <div className="space-y-2">
                <Textarea
                  rows={12}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="min-h-40 bg-white/30 border-gray-200 text-black placeholder-gray-400 focus-visible:ring-2 focus-visible:ring-indigo-500"
                  placeholder="ここに文章を入力..."
                />
                <div className="text-right text-xs text-gray-500">
                  文字数：{draft.length.toLocaleString()}
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  className="bg-purple-600 hover:bg-purple-700"
                  onClick={() => setShowAIModal(true)}
                >
                  AIで作成
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  onClick={handleSave}
                  disabled={submitFlag}
                >
                  {submitFlag ? "保存中..." : "保存"}
                </Button>
              </div>

              <div className="flex justify-center">
                <Button
                  className="bg-gray-200 text-gray-900 hover:bg-gray-300"
                  variant="outline"
                  onClick={() => {
                    setDraft(content);
                    setEditing(false);
                    setKeywords(["", "", ""]);
                  }}
                >
                  キャンセル
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== AI生成モーダル ===== */}
      <AnimatePresence>
        {showAIModal && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Overlay */}
            <motion.div
              className="absolute inset-0 bg-black/60"
              aria-hidden
              onClick={() => setShowAIModal(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            {/* Dialog */}
            <motion.div
              role="dialog"
              aria-modal="true"
              className="relative w-full max-w-md mx-4 rounded-2xl bg-white p-6 shadow-2xl space-y-4"
              initial={{ opacity: 0, y: 14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
            >
              <h2 className="text-xl font-bold text-center">AIで文章を生成</h2>
              <p className="text-sm text-gray-500 text-center">
                ・最低1個以上のキーワードを入力してください
              </p>

              {/* 縦並びキーワード入力 */}
              <div className="flex flex-col gap-2">
                {keywords.map((word, i) => (
                  <input
                    key={i}
                    type="text"
                    className="border p-2 rounded text-black focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder={`キーワード${i + 1}`}
                    value={word}
                    onChange={(e) => {
                      const newKeywords = [...keywords];
                      newKeywords[i] = e.target.value;
                      setKeywords(newKeywords);
                    }}
                  />
                ))}
              </div>

              {/* 入力中プレビュー（任意） */}
              <div className="min-h-6 text-xs text-gray-500">
                {nonEmptyKeywords.length > 0 && (
                  <span>
                    送信キーワード：
                    <span className="font-medium">
                      {nonEmptyKeywords.join(" ／ ")}
                    </span>
                  </span>
                )}
              </div>

              <Button
                className="bg-indigo-600 w-full disabled:opacity-50 hover:bg-indigo-700"
                disabled={nonEmptyKeywords.length === 0 || loading}
                onClick={async () => {
                  setLoading(true);
                  try {
                    const res = await fetch("/api/generate-about", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ keywords: nonEmptyKeywords }),
                    });
                    const data = await res.json();
                    setDraft(data.text);
                    setShowAIModal(false); // 成功後閉じる
                  } catch {
                    alert("生成に失敗しました");
                  } finally {
                    setLoading(false);
                    setKeywords(["", "", ""]);
                  }
                }}
              >
                {loading ? "生成中..." : "作成"}
              </Button>

              <Button
                className="bg-gray-200 text-gray-900 w-full hover:bg-gray-300"
                variant="outline"
                onClick={() => setShowAIModal(false)}
              >
                閉じる
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
