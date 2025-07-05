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
  }, [docRef]);

  const handleSave = async () => {
    await setDoc(docRef, { text: draft });
    setContent(draft);
    setEditing(false);
    alert("保存しました！");
  };



  return (
    <main className="max-w-3xl mx-auto ">
      <div className=" bg-white/50 p-5 ml-5 mr-5 rounded-lg shadow-2xs">


        <div className="bg-transparent p-4 rounded  leading-relaxed whitespace-pre-wrap bg-transparentt ">
          {content || "ただいま準備中です。"}
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-6 ">
        <section>
          <h3 className="text-xl font-semibold text-white/80 ">メディア掲載実績</h3>
          <ul className="mt-2 space-y-1 list-disc list-inside">
            <li>
              <a
                href="https://okeiko-kidz.com/shimosinjyo-11/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline hover:text-blue-800"
              >
                おけいこキッズ｜取材記事
              </a>
            </li>
            <li>
              <a
                href="https://higashiyodogawaku.goguynet.jp/2024/11/06/yotteya/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline hover:text-blue-800"
              >
                号外NET 東淀川区｜取材記事
              </a>
            </li>
          </ul>
        </section>
      </div>

      {isAdmin && !editing && (
        <Button onClick={() => setEditing(true)} className="mt-4 bg-blue-500">
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
              className="bg-transparentt border text-black placeholder-gray-400"
              placeholder="ここに文章を入力..."
            />

            <div className="flex justify-center gap-2">
              <Button className="bg-green-500" onClick={handleSave}>
                保存
              </Button>
              <Button
                className="bg-gray-300"
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
