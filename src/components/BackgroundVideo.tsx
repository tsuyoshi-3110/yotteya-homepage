"use client";
import React from "react";
import { useEffect, useState } from "react";
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import NextImage from "next/image";

const SITE_KEY = "yotteya";
const META_REF = doc(db, "siteSettings", SITE_KEY);
const POSTER_EXT = ".jpg";

type MediaType = "video" | "image";

interface MetaDoc {
  url: string;
  type: MediaType;
}

export default function BackgroundMedia() {
  /* state */
  const [url, setUrl] = useState<string | null>(null);
  const [type, setType] = useState<MediaType>("video");
  const [poster, setPoster] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const [isAdmin, setIsAdmin] = useState(false);
  const [editing, setEditing] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  const uploading = progress !== null;
  const loading = !!url && !ready;

  /* 初期読み込み */
  useEffect(() => onAuthStateChanged(auth, (u) => setIsAdmin(!!u)), []);

  useEffect(() => {
    (async () => {
      const snap = await getDoc(META_REF);
      if (snap.exists()) {
        const data = snap.data() as MetaDoc;
        setUrl(data.url);
        setType(data.type);
        if (data.type === "video") {
          setPoster(data.url.replace(/\.mp4(\?.*)?$/, POSTER_EXT));
        }
      }
    })().catch(console.error);
  }, []);

  /* アップロード */
  const upload = async () => {
    if (!file) return;

    const isVideo = file.type.startsWith("video/");
    const ext = isVideo ? "mp4" : "jpg";
    const path = `${
      isVideo ? "videos" : "images"
    }/public/${SITE_KEY}/homeBackground.${ext}`;
    const storageRef = ref(getStorage(), path);

    try {
      await deleteObject(storageRef);
    } catch {
      // ファイルが無くても気にしない
    }

    const task = uploadBytesResumable(storageRef, file, {
      contentType: file.type,
    });
    setProgress(0);

    task.on(
      "state_changed",
      (s) => setProgress(Math.round((s.bytesTransferred / s.totalBytes) * 100)),
      (e) => {
        console.error(e);
        alert("アップロード失敗");
        setProgress(null);
      },
      async () => {
        const downloadURL = await getDownloadURL(storageRef);
        await setDoc(META_REF, {
          url: downloadURL,
          type: isVideo ? "video" : "image",
        });

        const bust = `?ts=${Date.now()}`;
        setUrl(downloadURL + bust);
        setType(isVideo ? "video" : "image");
        setPoster(
          isVideo
            ? downloadURL.replace(/\.mp4(\?.*)?$/, POSTER_EXT) + bust
            : null
        );
        setReady(false);
        setProgress(null);
        setFile(null);
        setEditing(false);
        alert("背景を更新しました！");
      }
    );
  };

  /* 描画 */
  const renderMedia = () => {
    if (!url) return null;
    if (type === "video")
      return (
        <video
          key={url}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          poster={poster ?? ""}
          onCanPlay={() => setReady(true)}
          className="absolute inset-0 w-full h-full object-contain bg-transparen"
        >
          <source src={url} type="video/mp4" />
        </video>
      );

    return (
      <NextImage
        src={url}
        alt="背景"
        fill
        className="absolute inset-0 w-full h-full object-contain bg-transparen"
        onLoad={() => setReady(true)}
        priority
        sizes="100vw"
      />
    );
  };

  return (
    <div className="fixed inset-0 top-12 bg-transparen">
      {/* 背景メディア */}
      {renderMedia()}

      {/* ① 動画読み込み中だけ全画面マスク */}
      {loading && (
        <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-black/60 gap-4">
          <svg
            className="w-12 h-12 animate-spin text-pink-500"
            viewBox="0 0 24 24"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              className="opacity-20"
            />
            <path
              fill="currentColor"
              className="opacity-80"
              d="M12 2a8 8 0 018 8h-4a4 4 0 00-4-4V2z"
            />
          </svg>
          <p className="text-white">動画を読み込み中…</p>
        </div>
      )}

      {/* ② 管理者 UI */}
      {isAdmin && (
        <>
          {/* 編集ボタン */}
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              disabled={uploading}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-pink-600 text-white rounded shadow disabled:opacity-50"
            >
              背景編集
            </button>
          )}

          {/* 編集モーダル */}
          {editing && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="w-full max-w-sm bg-white p-6 rounded-lg space-y-5">
                <h2 className="text-lg font-bold text-center">背景を更新</h2>

                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="w-full bg-gray-100 border px-3 py-2 rounded text-sm"
                  disabled={uploading}
                />

                {/* ③ アップロード中だけプログレスバー表示 */}
                {uploading && (
                  <div className="space-y-1">
                    <p className="text-center text-sm font-medium">
                      アップロード中… {progress}%
                    </p>
                    <div className="w-64 h-2 bg-gray-700 rounded mx-auto">
                      <div
                        className="h-full bg-green-500 rounded transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-2 justify-center pt-1">
                  <button
                    onClick={upload}
                    disabled={!file || uploading}
                    className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
                  >
                    アップロード
                  </button>
                  <button
                    onClick={() =>
                      !uploading && (setEditing(false), setFile(null))
                    }
                    className="px-4 py-2 bg-gray-500 text-white rounded disabled:opacity-50"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
