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
import { Button } from "@/components/ui/button";
import imageCompression from "browser-image-compression";

import ThemeWallpaper from "./ThemeWallpaper";
import HeaderLogoPicker from "./HeaderLogoPicker";

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
  const [setteisite, setSetteisite] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!url || url.trim() === "") {
      setReady(false);
      setSetteisite("トップメディアを設定してください");
    } else {
      setReady(true);
      setSetteisite("");
    }
  }, [url]);

  useEffect(() => {
    (async () => {
      const snap = await getDoc(META_REF);
      if (!snap.exists()) {
        setIsLoaded(true);
        return;
      }
      const data = snap.data() as MetaDoc;

      if (data.themeGradient && THEMES[data.themeGradient]) {
        setTheme(data.themeGradient);
      }

      if (typeof data.url === "string" && data.url.trim() !== "") {
        setUrl(data.url);
      }

      if (data.type) {
        setType(data.type);
        if (data.type === "video" && data.url) {
          setPoster(data.url.replace(/\.mp4(\?.*)?$/, POSTER_EXT));
        }
      }

      setIsLoaded(true); // ← 最後に必ず
    })().catch((err) => console.error("背景データ取得失敗:", err));
  }, []);

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

    const MAX_SIZE_MB = 200;
    const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

    if (file.size > MAX_SIZE_BYTES) {
      alert(`動画サイズが大きすぎます。最大 ${MAX_SIZE_MB}MB までです。`);
      return;
    }

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
          onLoadedData={() => setReady(true)} // ← 修正
          className="absolute inset-0 w-full h-full object-contain"
        >
          <source src={url} type="video/mp4" />
        </video>
      );
    }

    return (
      <NextImage
        src={url}
        alt=""
        fill
        className="absolute inset-0 w-full h-full object-contain"
        onLoad={() => setReady(true)}
        priority
        sizes="100vw"
      />
    );
  };

  const uploadImage = async (imageFile: File) => {
    const imagePath = `images/public/${SITE_KEY}/wallpaper.jpg`;
    const imageRef = ref(getStorage(), imagePath);

    try {
      await deleteObject(imageRef);
    } catch {
      // 画像がなければ無視
    }

    const task = uploadBytesResumable(imageRef, imageFile);

    setProgress(0); // プログレスバー表示

    task.on(
      "state_changed",
      (snapshot) => {
        const percent = Math.round(
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        );
        setProgress(percent);
      },
      (error) => {
        console.error("画像アップロード失敗:", error);
        setProgress(null);
        alert("アップロードに失敗しました");
      },
      async () => {
        const imageUrl = await getDownloadURL(imageRef);
        await setDoc(META_REF, { imageUrl }, { merge: true });

        setProgress(null); // 完了後モーダル非表示
        alert("画像を更新しました！");
      }
    );
  };

  const uploadHeaderImage = async (file: File) => {
    const imagePath = `images/public/${SITE_KEY}/headerLogo.jpg`;
    const imageRef = ref(getStorage(), imagePath);

    const compressedFile = await imageCompression(file, {
      maxWidthOrHeight: 96,
      maxSizeMB: 0.3,
      useWebWorker: true,
    });

    try {
      await deleteObject(imageRef);
    } catch {}

    const task = uploadBytesResumable(imageRef, compressedFile);
    setProgress(0); // プログレスバー表示

    task.on(
      "state_changed",
      (snapshot) => {
        const percent = Math.round(
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        );
        setProgress(percent);
      },
      (error) => {
        console.error("ロゴアップロード失敗:", error);
        setProgress(null);
        alert("アップロードに失敗しました");
      },
      async () => {
        const downloadURL = await getDownloadURL(imageRef);
        await setDoc(
          doc(db, "siteSettings", SITE_KEY),
          { headerLogoUrl: downloadURL },
          { merge: true }
        );
        setProgress(null);
        alert("ヘッダー画像を更新しました！");
      }
    );
  };

  return (
    <div className="fixed inset-0 top-12">
      {url && renderMedia()}

      {loading && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
          <div className="text-white text-lg">読み込み中...</div>
        </div>
      )}

      {isAdmin && (
        <>
          {progress !== null && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
              <div className="bg-white rounded-lg p-6 shadow-md w-full max-w-sm">
                <p className="text-center text-gray-800 mb-2">
                  アップロード中… {progress}%
                </p>
                <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {!editing && (
            <>
              {isLoaded && !url && (
                <div className=" inset-0 mt-20 flex items-center justify-center">
                  <p className="text-white text-lg">{setteisite}</p>
                </div>
              )}
              {/* 編集ボタンなど他の管理機能 */}
              {!editing && (
                <Button
                  onClick={() => setEditing(true)}
                  disabled={uploading}
                  size="sm"
                  className="absolute bottom-35 left-1/2 -translate-x-1/2  bg-blue-500 text-white rounded shadow"
                >
                  トップメディア
                </Button>
              )}

              {/* カラーセレクター（ログインユーザーのみ表示） */}
              <div className="absolute bottom-50 left-1/2 -translate-x-1/2">
                <ThemeSelector
                  currentTheme={theme}
                  onChange={handleThemeChange}
                />
              </div>

              <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-8 items-end">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-sm text-white">背景画像</span>
                  <ThemeWallpaper
                    onFileSelect={async (file) => {
                      await uploadImage(file);
                    }}
                  />
                </div>

                <div className="flex flex-col items-center gap-1">
                  <span className="text-sm text-white">ロゴ画像</span>
                  <HeaderLogoPicker
                    onSelectFile={async (file) => {
                      await uploadHeaderImage(file);
                    }}
                  />
                </div>
              </div>
            </>
          )}

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
