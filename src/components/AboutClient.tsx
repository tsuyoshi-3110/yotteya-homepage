"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export default function AboutClient() {
  const [content, setContent] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [editing, setEditing] = useState<boolean>(false);
  const [draft, setDraft] = useState<string>("");

  /* ここだけ変えれば他サイトにも流用できます */
  const SITE_KEY = "yotteya";

  /* 4 セグメント = ドキュメント参照
   sitePages / {siteId} / pages / about */
  const docRef = doc(db, "sitePages", SITE_KEY, "pages", "about");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => setIsAdmin(!!user));
    return () => unsub();
  }, []);

  useEffect(() => {
    getDoc(docRef).then((snap) => {
      if (snap.exists()) {
        const text = snap.data().text;
        setContent(text);
        setDraft(text);
      }
    });
  }, []);

  const handleSave = async () => {
    await setDoc(docRef, { text: draft });
    setContent(draft);
    setEditing(false);
    alert("保存しました！");
  };

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6 mt-20">
      <h1 className="text-3xl font-bold text-center mb-4">当店の思い</h1>

      <div className="bg-pink-50 p-4 rounded shadow-lg border border-pink-200 leading-relaxed whitespace-pre-wrap bg-transparent">
        {content || "ただいま準備中です。"}
      </div>

      {isAdmin && !editing && (
        <Button onClick={() => setEditing(true)} className="mt-4">
          編集する
        </Button>
      )}

      {isAdmin && editing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl space-y-4 shadow-xl relative">
            <h2 className="text-xl font-bold text-center">内容を編集</h2>

            <Textarea
              rows={10}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="bg-transparent border border-pink-300 text-black placeholder-gray-400"
              placeholder="ここに文章を入力..."
            />

            <div className="flex justify-center gap-2">
              <Button onClick={handleSave}>保存</Button>
              <Button
                variant="outline"
                onClick={() => {
                  setDraft(content);
                  setEditing(false);
                }}
              >
                キャンセル
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
