/* ─ src/app/(routes)/home/page.tsx ─ 背景動画 + アップロード UI  */
"use client";

import { useEffect, useState } from "react";
import Head from "next/head";
import {
  getStorage,
  ref,
  getDownloadURL,
  uploadBytesResumable,
} from "firebase/storage";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

/* ----------------------- 設 定 ----------------------- */
const SITE_KEY = "yotteya";
const META_REF = doc(db, "siteSettings", SITE_KEY);
const SITE_PATH = `videos/public/${SITE_KEY}/homeBackground.mp4`;
const POSTER_EXT = ".jpg";

/* ===================================================== */
export default function HomePage() {
  /* ===================================================== */

  /* ------------ state ------------ */
  const [hydrated, setHydrated] = useState(false); // ⚑ 追加
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editing, setEditing] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  const uploading = progress !== null;
  const buffering = !!videoUrl && !videoReady;

  /* ------------ lifecycle ------------ */
  useEffect(() => setHydrated(true), []); // ⚑ 追加

  useEffect(() => onAuthStateChanged(auth, (u) => setIsAdmin(!!u)), []);

  useEffect(() => {
    (async () => {
      const snap = await getDoc(META_REF);
      if (snap.exists()) {
        const url = snap.data().url as string;
        setVideoUrl(url);
        setPosterUrl(url.replace(/\.mp4(\?.*)?$/, POSTER_EXT));
      }
    })().catch((e) => console.error("動画取得失敗:", e));
  }, []);

  /* ------------ アップロード ------------ */
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

        const bust = `&ts=${Date.now()}`;
        setVideoReady(false);
        setVideoUrl(`${url}${bust}`);
        setPosterUrl(`${url.replace(/\.mp4$/, POSTER_EXT)}${bust}`);
        setProgress(null);
        setFile(null);
        alert("動画を更新しました！");
      }
    );
  };

  /* ------------ JSX ------------ */
  return (
    <>
      {/* preload は CSR 時のみ注入して差分を無くす */}
      {hydrated && videoUrl && (
        <Head>
          <link rel="preload" as="video" href={videoUrl} type="video/mp4" />
          {posterUrl && (
            <link rel="preload" as="image" href={posterUrl} type="image/jpeg" />
          )}
        </Head>
      )}

      <div
        /* ナビバー（mt-8 = 2rem）を除いた高さを計算 */
        className="relative overflow-hidden mt-10"
        style={{ minHeight: "calc(100vh - 9rem)" }}
      >
        {videoUrl && (
          <video
            key={videoUrl}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            poster={hydrated && posterUrl ? posterUrl : undefined}
            suppressHydrationWarning
            onCanPlay={() => setVideoReady(true)}
            className="absolute inset-0 w-full h-full
                       object-contain md:object-cover bg-transparent"
          >
            <source src={videoUrl} type="video/mp4" />
          </video>
        )}

        {videoUrl && <div className="absolute inset-0 bg-black/40" />}

        {(uploading || buffering) && (
          <div
            className="absolute inset-0 z-30 flex flex-col items-center
                          justify-center bg-black/60 gap-4"
          >
            <svg
              className="w-10 h-10 animate-spin text-pink-500"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                className="opacity-25"
              />
              <path
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                fill="currentColor"
                className="opacity-75"
              />
            </svg>

            {uploading ? (
              <>
                <p className="text-white text-sm">
                  アップロード中… {progress}%
                </p>
                <div className="w-64 h-2 bg-gray-700 rounded">
                  <div
                    className="h-full bg-green-500 rounded transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </>
            ) : (
              <p className="text-white text-sm">動画を読み込み中…</p>
            )}
          </div>
        )}

        {/* 管理 UI */}
        <div className="relative z-20 text-white text-center p-6">
          {isAdmin &&
            (editing ? (
              <div className="mt-4 space-y-4">
                <input
                  type="file"
                  accept="video/mp4"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="bg-gray-600/70 w-full h-10 px-3 py-1 rounded text-sm"
                  disabled={uploading}
                />
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={handleUpload}
                    disabled={!file || uploading}
                    className="px-4 py-2 bg-green-600 rounded disabled:opacity-50"
                  >
                    アップロード
                  </button>
                  <button
                    onClick={() => {
                      setEditing(false);
                      setFile(null);
                    }}
                    disabled={uploading}
                    className="px-4 py-2 bg-gray-500 rounded disabled:opacity-50"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setEditing(true)}
                disabled={uploading}
                className="mt-4 px-4 py-2 bg-pink-600 rounded disabled:opacity-50"
              >
                動画編集
              </button>
            ))}
        </div>
      </div>
    </>
  );
}
