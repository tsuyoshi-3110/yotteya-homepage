"use client";
import React, { useEffect, useState } from "react";
import NextImage from "next/image";
import { onAuthStateChanged } from "firebase/auth";
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { THEMES, ThemeKey } from "@/lib/themes";
import ThemeSelector from "./ThemeSelector";

const SITE_KEY = "yotteya";
const META_REF = doc(db, "siteSettings", SITE_KEY);
const POSTER_EXT = ".jpg";

type MediaType = "video" | "image";

type MetaDoc = {
  url?: string;
  type?: MediaType;
  themeGradient?: ThemeKey;
};

export default function BackgroundMedia() {
  const [url, setUrl] = useState<string | null>(null);
  const [type, setType] = useState<MediaType>("video");
  const [poster, setPoster] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editing, setEditing] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [theme, setTheme] = useState<ThemeKey>("brandA");

  const uploading = progress !== null;
  const loading = !!url && !ready;

  useEffect(() => {
    onAuthStateChanged(auth, (user) => setIsAdmin(!!user));
  }, []);

  useEffect(() => {
    (async () => {
      const snap = await getDoc(META_REF);
      if (!snap.exists()) return;
      const data = snap.data() as MetaDoc;

      if (data.themeGradient && THEMES[data.themeGradient]) {
        setTheme(data.themeGradient);
      }

      if (data.url) {
        setUrl(data.url);
      }

      if (data.type) {
        setType(data.type);
        if (data.type === "video" && data.url) {
          setPoster(data.url.replace(/\.mp4(\?.*)?$/, POSTER_EXT));
        }
      }
    })().catch((err) => console.error("背景データ取得失敗:", err));
  }, []);

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
      // 無視
    }

    const task = uploadBytesResumable(storageRef, file, {
      contentType: file.type,
    });

    setProgress(0);

    task.on(
      "state_changed",
      (snapshot) => {
        setProgress(
          Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
        );
      },
      (error) => {
        console.error(error);
        alert("アップロード失敗");
        setProgress(null);
      },
      async () => {
        const downloadURL = await getDownloadURL(storageRef);
        const bust = `?ts=${Date.now()}`;

        await setDoc(META_REF, {
          url: downloadURL,
          type: isVideo ? "video" : "image",
          themeGradient: theme,
        });

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

  const handleThemeChange = async (newTheme: ThemeKey) => {
    setTheme(newTheme);
    await setDoc(META_REF, { themeGradient: newTheme }, { merge: true });
  };

  const renderMedia = () => {
    if (!url) return null;
    if (type === "video") {
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
          className="absolute inset-0 w-full h-full object-contain"
        >
          <source src={url} type="video/mp4" />
        </video>
      );
    }

    return (
      <NextImage
        src={url}
        alt="背景"
        fill
        className="absolute inset-0 w-full h-full object-contain"
        onLoad={() => setReady(true)}
        priority
        sizes="100vw"
      />
    );
  };

  return (
    <div className="fixed inset-0 top-12">
      {renderMedia()}

      {loading && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
          <div className="text-white text-lg">読み込み中...</div>
        </div>
      )}

      {isAdmin && (
        <>
          {!editing && (
            <>
              {/* 編集ボタンなど他の管理機能 */}
              {!editing && (
                <button
                  onClick={() => setEditing(true)}
                  disabled={uploading}
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-blue-500 text-white rounded shadow"
                >
                  背景編集
                </button>
              )}
            </>
          )}

          {/* カラーセレクター（ログインユーザーのみ表示） */}
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2">
            <ThemeSelector currentTheme={theme} onChange={handleThemeChange} />
          </div>

          {editing && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="w-full max-w-sm bg-white p-6 rounded-lg">
                <h2 className="text-lg font-bold text-center mb-4">
                  背景を更新
                </h2>

                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="w-full bg-gray-100 border px-3 py-2 rounded text-sm mb-4"
                  disabled={uploading}
                />

                {uploading && (
                  <div className="mb-4">
                    <p className="text-sm text-center mb-1">
                      アップロード中… {progress}%
                    </p>
                    <div className="w-full h-2 bg-gray-300 rounded">
                      <div
                        className="h-full bg-green-500 rounded"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-2 justify-center">
                  <button
                    onClick={upload}
                    disabled={!file || uploading}
                    className="px-4 py-2 bg-green-600 text-white rounded"
                  >
                    アップロード
                  </button>
                  <button
                    onClick={() => {
                      if (!uploading) {
                        setEditing(false);
                        setFile(null);
                      }
                    }}
                    className="px-4 py-2 bg-gray-500 text-white rounded"
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
