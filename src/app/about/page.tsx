"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import Head from "next/head";

export default function AboutPage() {
  const [content, setContent] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [editing, setEditing] = useState<boolean>(false);
  const [draft, setDraft] = useState<string>("");

  const docRef = doc(db, "sitePages", "about");

  // ログインユーザー判定
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => setIsAdmin(!!user));
    return () => unsub();
  }, []);

  // Firestoreからデータ取得
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
    <>
      {/* ✅ SEOメタタグ */}
      <Head>
        <title>当店の思い｜甘味処 よって屋</title>
        <meta
          name="description"
          content="甘味処 よって屋の想いをご紹介します。素材へのこだわりとお客様への気持ちを込めたメッセージ。"
        />
        <meta property="og:title" content="当店の思い｜甘味処 よって屋" />
        <meta
          property="og:description"
          content="ふんわり生地とこだわりクリームで皆様に笑顔を。大阪市〇〇区で営業中。"
        />
        <meta property="og:image" content="/ogp-about.jpg" />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="ja_JP" />
      </Head>

      <main className="max-w-3xl mx-auto p-6 space-y-6 mt-20">
        <div className="bg-pink-50 p-4 rounded shadow-lg border-1 leading-relaxed whitespace-pre-wrap bg-transparent">
          {content || "ただいま準備中です。"}
        </div>

        {isAdmin && (
          <>
            {!editing ? (
              <Button onClick={() => setEditing(true)} className="mt-4">
                編集する
              </Button>
            ) : (
              <div className="space-y-4 mt-6">
                <Textarea
                  rows={8}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
                <div className="flex gap-2">
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
            )}
          </>
        )}
      </main>
    </>
  );
}
