"use client";

import { useEffect, useState } from "react";
import {
  getStorage,
  ref,
  getDownloadURL,
  uploadBytesResumable,
} from "firebase/storage";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

/* ───────── 固定キー ───────── */
const SITE_KEY = "yotteya";
const META_REF = doc(db, "siteSettings", SITE_KEY); // URL 保存先
const SITE_PATH = `videos/public/${SITE_KEY}/homeBackground.mp4`;

export default function HomePage() {
  /* state */
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editing, setEditing] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  /* 権限判定 */
  useEffect(() => onAuthStateChanged(auth, (u) => setIsAdmin(!!u)), []);

  /* 初期ロード – Firestore にある場合のみ取得 */
  useEffect(() => {
    (async () => {
      const snap = await getDoc(META_REF);
      if (snap.exists()) {
        setVideoUrl(snap.data().url as string);
      }
      /* 無ければ何も表示しない（videoUrl = null のまま）*/
    })().catch((e) => console.error("動画取得失敗:", e));
  }, []);

  /* アップロード */
  const handleUpload = () => {
    if (!file) return;

    const task = uploadBytesResumable(ref(getStorage(), SITE_PATH), file);
    setProgress(0);
    setEditing(false);

    task.on(
      "state_changed",
      (s) => setProgress(Math.round((s.bytesTransferred / s.totalBytes) * 100)),
      (e) => {
        console.error(e);
        alert("アップロード失敗");
        setProgress(null);
      },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        await setDoc(META_REF, { url });
        setVideoUrl(`${url}&ts=${Date.now()}`); // キャッシュバスター付き
        setProgress(null);
        setFile(null);
        alert("動画を更新しました！");
      }
    );
  };

  /* --------------- UI --------------- */
  return (
    <div className="relative min-h-screen overflow-hidden mt-16">
      {/* カスタム動画があるときだけ描画 */}
      {videoUrl && (
        <video
          key={videoUrl}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          className="absolute inset-0 w-full h-full object-contain bg-black"
        >
          <source src={videoUrl} type="video/mp4" />
        </video>
      )}

      {/* 透かし黒オーバーレイ */}
      {videoUrl && <div className="absolute inset-0 bg-black/40" />}

      {/* 進捗バー */}
      {progress !== null && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 gap-4">
          <p className="text-white">アップロード中… {progress}%</p>
          <div className="w-64 h-2 bg-gray-700 rounded">
            <div
              className="h-full bg-green-500 rounded"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* 管理 UI */}
      <div className="relative z-10 text-white text-center p-6">
        {isAdmin &&
          (editing ? (
            <div className="mt-4 space-y-4">
              <input
                type="file"
                accept="video/mp4"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="bg-gray-500 text-white w-full h-10 px-3 py-1 rounded"
              />
              <div className="flex gap-2 justify-center">
                <button
                  onClick={handleUpload}
                  disabled={!file}
                  className="px-4 py-2 bg-green-600 rounded disabled:opacity-50"
                >
                  アップロード
                </button>
                <button
                  onClick={() => {
                    setEditing(false);
                    setFile(null);
                  }}
                  className="px-4 py-2 bg-gray-500 rounded"
                >
                  キャンセル
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="mt-4 px-4 py-2 bg-pink-600 rounded"
            >
              動画編集
            </button>
          ))}
      </div>
    </div>
  );
}
