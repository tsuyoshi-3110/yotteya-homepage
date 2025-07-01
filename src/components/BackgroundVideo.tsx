// components/BackgroundVideo.tsx
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

const SITE_KEY = "yotteya";
const META_REF = doc(db, "siteSettings", SITE_KEY);
const SITE_PATH = `videos/public/${SITE_KEY}/homeBackground.mp4`;
const POSTER_EXT = ".jpg";

export default function BackgroundVideo() {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editing, setEditing] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  const uploading = progress !== null;
  const buffering = !!videoUrl && !videoReady;

  useEffect(() => onAuthStateChanged(auth, (u) => setIsAdmin(!!u)), []);
  useEffect(() => {
    (async () => {
      const snap = await getDoc(META_REF);
      if (!snap.exists()) return;
      const url = snap.data().url as string;
      setVideoUrl(url);
      setPosterUrl(url.replace(/\.mp4(\?.*)?$/, POSTER_EXT));
    })().catch(console.error);
  }, []);

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

  return (
    <div className="fixed inset-x-0 top-10 bottom-0 overflow-hidden bg-transparent">
      {videoUrl && (
        <video
          key={videoUrl}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          poster={posterUrl ?? ""}
          onCanPlay={() => setVideoReady(true)}
          className="absolute inset-0 w-full h-full object-contain bg-transparen"
        >
          <source src={videoUrl} type="video/mp4" />
        </video>
      )}

      {/* 準備中やアップロード中のオーバーレイ */}
      {(uploading || buffering) && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/60 gap-4">
          <svg
            className="w-10 h-10 animate-spin text-pink-500"
            viewBox="0 0 24 24"
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
              fill="currentColor"
              className="opacity-75"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
          </svg>
          {uploading ? (
            <p className="text-white">アップロード中… {progress}%</p>
          ) : (
            <p className="text-white">動画を読み込み中…</p>
          )}
        </div>
      )}

      {/* 管理者用 UI */}
      {isAdmin && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-center">
          {editing ? (
            <div className="space-y-2">
              <input
                type="file"
                accept="video/mp4"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                disabled={uploading}
                className="bg-gray-700 text-white px-2 py-1 rounded"
              />
              <div className="flex justify-center gap-2 mt-2">
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
              className="px-4 py-2 bg-pink-600 rounded disabled:opacity-50"
            >
              動画編集
            </button>
          )}
        </div>
      )}
    </div>
  );
}
