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
import { ThemeKey } from "@/lib/themes";
import ThemeSelector from "./ThemeSelector";
import { Button } from "@/components/ui/button";
import imageCompression from "browser-image-compression";

import ThemeWallpaper from "./ThemeWallpaper";
import HeaderLogoPicker from "./HeaderLogoPicker";
import Slideshow from "./Slideshow";
import CrepeLoader from "./CrepeLoader";

const SITE_KEY = "yotteya";
const META_REF = doc(db, "siteSettingsEditable", SITE_KEY);
const POSTER_EXT = ".jpg";

type MediaType = "video" | "image";

type MetaDoc = {
  url?: string;
  type?: MediaType;
  themeGradient?: ThemeKey;
  imageUrls?: string[];
};

export default function BackgroundMedia() {
  const [url, setUrl] = useState<string | null>(null);
  const [type, setType] = useState<MediaType>("video");
  const [poster, setPoster] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editing, setEditing] = useState(false);
  const [file, setFile] = useState<File | File[] | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [theme, setTheme] = useState<ThemeKey>("brandA");
  const [imageUrls, setImageUrls] = useState<string[]>([]);

  const uploading = progress !== null;

  const loading =
    (type === "video" && !ready && !!url) ||
    (type === "image" && !ready && imageUrls.length > 0);

  useEffect(() => {
    onAuthStateChanged(auth, (user) => setIsAdmin(!!user));
  }, []);

  useEffect(() => {
    if (type === "image" && imageUrls.length > 0) {
      setReady(false);
      const timer = setTimeout(() => setReady(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [imageUrls, type]);

  useEffect(() => {
    (async () => {
      const snap = await getDoc(META_REF);
      if (!snap.exists()) return;
      const data = snap.data() as MetaDoc;

      if (data.imageUrls) {
        setImageUrls(data.imageUrls);
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

  useEffect(() => {
    const timeout = setTimeout(() => {
      setReady(true); // ← 5秒後に読み込み強制解除
    }, 5000);
    return () => clearTimeout(timeout);
  }, []);

  const upload = async () => {
    if (!file) return;

    const MAX_SIZE_MB = 200;
    const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

    // ✅ 動画アップロード処理
    if (file instanceof File && file.type.startsWith("video/")) {
      if (file.size > MAX_SIZE_BYTES) {
        alert(`動画サイズが大きすぎます。最大 ${MAX_SIZE_MB}MB までです。`);
        return;
      }

      const ext = "mp4";
      const path = `videos/public/${SITE_KEY}/homeBackground.${ext}`;
      const storageRef = ref(getStorage(), path);

      try {
        await deleteObject(storageRef);
      } catch {}

      const task = uploadBytesResumable(storageRef, file, {
        contentType: file.type,
      });

      setProgress(0); // ✅ プログレスバー開始

      task.on(
        "state_changed",
        (snapshot) => {
          const percent = Math.round(
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          );
          setProgress(percent);
        },
        (error) => {
          console.error("動画アップロード失敗:", error);
          alert("アップロード失敗");
          setProgress(null);
        },
        async () => {
          const downloadURL = await getDownloadURL(storageRef);
          const bust = `?ts=${Date.now()}`;

          await setDoc(
            META_REF,
            {
              url: downloadURL,
              type: "video",
              themeGradient: theme,
            },
            { merge: true }
          );

          setUrl(downloadURL + bust);
          setType("video");
          setPoster(downloadURL.replace(/\.mp4(\?.*)?$/, POSTER_EXT) + bust);
          setReady(false);
          setProgress(null);
          setFile(null);
          setEditing(false);
          alert("メディアを更新しました！");
        }
      );
    }

    // ✅ 画像複数枚アップロード処理
    else if (Array.isArray(file)) {
      const validFiles = file.slice(0, 3);
      const urls: string[] = [];

      for (let i = 0; i < validFiles.length; i++) {
        const image = validFiles[i];
        const imagePath = `images/public/${SITE_KEY}/wallpaper_${i}.jpg`;
        const imageRef = ref(getStorage(), imagePath);

        try {
          await deleteObject(imageRef);
        } catch {}

        // ✅ 枚数ベースで進捗表示（0〜100）
        setProgress(Math.round(((i + 1) / validFiles.length) * 100));

        const task = uploadBytesResumable(imageRef, image);
        await new Promise<void>((resolve, reject) => {
          task.on(
            "state_changed",
            null, // 個別の詳細progress追跡はしない（簡易モード）
            (error) => {
              console.error("画像アップロード失敗:", error);
              reject(error);
            },
            async () => {
              const url = await getDownloadURL(imageRef);
              urls.push(url);
              resolve();
            }
          );
        });
      }

      setProgress(null); // ✅ アップロード完了で非表示

      await setDoc(
        META_REF,
        {
          imageUrls: urls,
          type: "image",
          themeGradient: theme,
        },
        { merge: true }
      );

      setImageUrls(urls);
      setType("image");
      setReady(false);
      setFile(null);
      setEditing(false);
      alert("画像を更新しました！");
    }

    // ✅ その他：不正ファイル形式
    else {
      alert(
        "不正なファイル形式です。画像は最大3枚、動画は1本のみ対応しています。"
      );
    }
  };

  const handleThemeChange = async (newTheme: ThemeKey) => {
    setTheme(newTheme);
    await setDoc(META_REF, { themeGradient: newTheme }, { merge: true });
  };

  const renderMedia = () => {
    if (type === "video" && url) {
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

    if (type === "image" && imageUrls.length === 1) {
      return (
        <NextImage
          src={imageUrls[0]}
          alt="背景画像"
          fill
          className="absolute inset-0 w-full h-full object-contain"
          onLoad={() => setReady(true)}
          priority
          sizes="100vw"
        />
      );
    }

    if (type === "image" && imageUrls.length > 1) {
      return (
        <Slideshow
          urls={imageUrls}
          onFirstLoad={() => setReady(true)} // スライドの最初の画像読み込み後にready
        />
      );
    }

    return null;
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
      maxWidthOrHeight: 160, // ✅ 解像度を少し上げる（例：96 → 160）
      maxSizeMB: 0.5, // ✅ 最大サイズを0.3MB → 0.5MBに増加
      initialQuality: 0.9, // ✅ 明示的に高画質を指定（デフォルトは自動）
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
          doc(db, "siteSettingsEditable", SITE_KEY),
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
      {renderMedia()}

      {loading && <CrepeLoader />}

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
              {/* 編集ボタンなど他の管理機能 */}
              {!editing && (
                <Button
                  onClick={() => setEditing(true)}
                  disabled={uploading}
                  size="sm"
                  className="absolute bottom-43 left-1/2 -translate-x-1/2  bg-blue-500 text-white rounded shadow"
                >
                  トップ画像・動画
                </Button>
              )}

              {/* カラーセレクター（ログインユーザーのみ表示） */}
              <div className="absolute bottom-60 left-1/2 -translate-x-1/2">
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
                  メディアを更新
                </h2>

                <div className="flex flex-col space-y-1">
                  <label>・動画は1本</label>
                  <label>・画像は1~3枚</label>
                </div>

                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={(e) => {
                    const files = e.target.files;
                    if (!files || files.length === 0) return;

                    const fileArray = Array.from(files);
                    const videoFiles = fileArray.filter((f) =>
                      f.type.startsWith("video/")
                    );
                    const imageFiles = fileArray.filter((f) =>
                      f.type.startsWith("image/")
                    );

                    // ✅ 動画と画像が混在している場合 → NG
                    if (videoFiles.length > 0 && imageFiles.length > 0) {
                      alert(
                        "動画と画像は同時に選択できません。どちらか一方のみ選んでください。"
                      );
                      e.target.value = ""; // 選択リセット
                      return;
                    }

                    // ✅ 動画が2本以上ある場合 → NG
                    if (videoFiles.length > 1) {
                      alert("動画は1本だけ選択できます。");
                      e.target.value = "";
                      return;
                    }

                    // ✅ 画像が4枚以上ある場合 → NG
                    if (imageFiles.length > 3) {
                      alert("画像は最大3枚まで選択できます。");
                      e.target.value = "";
                      return;
                    }

                    // ✅ 動画1本のみ → OK
                    if (videoFiles.length === 1 && imageFiles.length === 0) {
                      setFile(videoFiles[0]);
                      return;
                    }

                    // ✅ 画像のみ（1〜3枚） → OK
                    if (imageFiles.length > 0 && videoFiles.length === 0) {
                      setFile(imageFiles);
                      return;
                    }

                    // ✅ それ以外（念のため） → NG
                    alert("ファイルの形式が正しくありません。");
                    e.target.value = "";
                  }}
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
