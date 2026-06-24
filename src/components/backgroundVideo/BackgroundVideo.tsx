// src/components/BackgroundMedia.tsx
"use client";

import React, { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  deleteObject,
  getDownloadURL,
  getStorage,
  ref,
  uploadBytesResumable,
} from "firebase/storage";
import { deleteField, doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { ThemeKey } from "@/lib/themes";
import { useSiteKey } from "@/lib/atoms/siteKeyAtom";

import { Button } from "@/components/ui/button";
import imageCompression from "browser-image-compression";
import BroomDustLoader from "../FeatherDusterLoader";
import AdminControls from "./AdminControls";
import MediaEditModal, { EditMediaItem, MediaType } from "./MediaEditModal";
import ProductMedia from "../ProductMedia";

// [migrated to useSiteKey] META_REF

type HeroItem = {
  src: string;
  type: MediaType;
};

type HeroVideoMeta = {
  name?: string;
  description?: string;
  contentUrl?: string;
  uploadDate?: string;
  thumbnailUrl?: string;
  durationSec?: number;
  duration?: string;
};

type MetaDoc = {
  url?: string;
  type?: MediaType;
  themeGradient?: ThemeKey;
  imageUrls?: string[];
  heroItems?: HeroItem[];
  heroVideo?: HeroVideoMeta;
};

export default function BackgroundMedia() {
  const siteKey = useSiteKey();
  const META_REF = doc(db, "siteSettingsEditable", siteKey);
  const [heroItems, setHeroItems] = useState<HeroItem[]>([]);
  const [heroVideoMeta, setHeroVideoMeta] = useState<HeroVideoMeta | undefined>(
    undefined,
  );
  const [theme, setTheme] = useState<ThemeKey>("brandA");

  const [isAdmin, setIsAdmin] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [editing, setEditing] = useState(false);

  const [progress, setProgress] = useState<number | null>(null);

  const [status, setStatus] = useState<
    "loading" | "paid" | "unpaid" | "pending" | "canceled" | "setup"
  >("loading");

  const uploading = progress !== null;

  /* Stripe サブスク状態チェック */
  useEffect(() => {
    const checkPayment = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionId = urlParams.get("session_id");

      const apiUrl = sessionId
        ? `/api/stripe/verify-subscription?session_id=${sessionId}`
        : `/api/stripe/check-subscription?siteKey=${siteKey}`;

      const res = await fetch(apiUrl);
      const json = await res.json();

      if (json.status === "active") setStatus("paid");
      else if (json.status === "pending_cancel") setStatus("pending");
      else if (json.status === "canceled") setStatus("canceled");
      else if (json.status === "setup_mode") setStatus("setup");
      else setStatus("unpaid");

      if (sessionId) {
        const cur = new URL(window.location.href);
        cur.searchParams.delete("session_id");
        window.history.replaceState({}, "", cur.toString());
      }
    };

    checkPayment();
  }, []);

  /* 管理者チェック */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setIsAdmin(!!user);
      setAuthChecked(true);
    });
    return unsub;
  }, []);

  /* Firestore から初期データ取得 */
  useEffect(() => {
    (async () => {
      const snap = await getDoc(META_REF);
      if (!snap.exists()) return;
      const data = snap.data() as MetaDoc;

      if (data.themeGradient) setTheme(data.themeGradient);

      const items: HeroItem[] = [];

      if (Array.isArray(data.heroItems) && data.heroItems.length > 0) {
        data.heroItems.forEach((i) => {
          if (i?.src && i?.type) {
            items.push({ src: i.src, type: i.type });
          }
        });
      } else {
        // 旧形式では type/url がトップ動画を表す。
        // 画像より先に追加しないと、動画が数秒間表示されず「消えた」ように見える。
        if (data.type === "video" && data.url) {
          items.push({ src: data.url, type: "video" });
        }
        if (Array.isArray(data.imageUrls)) {
          data.imageUrls.forEach((u) => {
            if (u) items.push({ src: u, type: "image" });
          });
        }
      }

      setHeroItems(items);

      if (data.heroVideo) {
        setHeroVideoMeta(data.heroVideo);
      }
    })().catch((err) => console.error("背景データ取得失敗:", err));
  }, []);

  /* 単発画像アップロード（既存機能） */
  const uploadImage = async (imageFile: File) => {
    const storage = getStorage();
    const imageRef = ref(storage, `images/public/${siteKey}/wallpaper.jpg`);

    try {
      await deleteObject(imageRef);
    } catch {}

    const task = uploadBytesResumable(imageRef, imageFile);
    setProgress(0);

    task.on(
      "state_changed",
      (snapshot) => {
        const percent = Math.round(
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100,
        );
        setProgress(percent);
      },
      (error) => {
        console.error("画像アップロード失敗:", error);
        setProgress(null);
        alert("アップロードに失敗しました");
      },
      async () => {
        const url = await getDownloadURL(imageRef);
        await setDoc(META_REF, { imageUrl: url }, { merge: true });
        setProgress(null);
        alert("画像を更新しました！");
      },
    );
  };

  /* ヘッダーロゴアップロード */
  const uploadHeaderImage = async (file: File) => {
    const storage = getStorage();
    const imageRef = ref(storage, `images/public/${siteKey}/headerLogo.jpg`);

    const compressedFile = await imageCompression(file, {
      maxWidthOrHeight: 160,
      maxSizeMB: 0.5,
      initialQuality: 0.9,
      useWebWorker: true,
    });

    try {
      await deleteObject(imageRef);
    } catch {}

    const task = uploadBytesResumable(imageRef, compressedFile);
    setProgress(0);

    task.on(
      "state_changed",
      (snapshot) => {
        const percent = Math.round(
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100,
        );
        setProgress(percent);
      },
      (error) => {
        console.error("ロゴアップロード失敗:", error);
        setProgress(null);
        alert("アップロードに失敗しました");
      },
      async () => {
        const url = await getDownloadURL(imageRef);
        await setDoc(
          doc(db, "siteSettingsEditable", siteKey),
          { headerLogoUrl: url },
          { merge: true },
        );
        setProgress(null);
        alert("ヘッダー画像を更新しました！");
      },
    );
  };

  /* 背景メディア保存（画像1〜3＋動画1 or 0件で削除） */
  const saveHeroMedia = async (items: EditMediaItem[]) => {
    // ★ 0件：背景を削除して何も表示しない状態にする
    if (items.length === 0) {
      try {
        const updateData: any = {
          themeGradient: theme,
          heroItems: [],
          type: deleteField(),
          url: deleteField(),
          imageUrls: deleteField(),
          heroVideo: deleteField(),
        };
        await setDoc(META_REF, updateData, { merge: true });

        setHeroItems([]);
        setHeroVideoMeta(undefined);
        setEditing(false);
        alert("背景メディアを削除しました。");
      } catch (e) {
        console.error("背景メディア削除に失敗:", e);
        alert("削除に失敗しました");
      }
      return;
    }

    const images = items.filter((m) => m.type === "image");
    const videos = items.filter((m) => m.type === "video");

    if (images.length > 3) {
      alert("画像は最大3枚までです。");
      return;
    }
    if (videos.length > 1) {
      alert("動画は1本までです。");
      return;
    }

    const storage = getStorage();
    const bust = `?ts=${Date.now()}`;

    const newHeroItems: HeroItem[] = [];
    let heroVideoMetaNext: HeroVideoMeta | undefined;

    const newFiles = items.filter((m) => m.mode === "new" && m.file);
    let uploadedCount = 0;
    const totalToUpload = newFiles.length;
    const updateProgress = () => {
      if (totalToUpload === 0) return;
      uploadedCount += 1;
      setProgress(Math.round((uploadedCount / totalToUpload) * 100));
    };
    if (totalToUpload > 0) setProgress(0);
    else setProgress(null);

    const uploadImageFile = async (file: File, index: number) => {
      const path = `images/public/${siteKey}/hero_${index}.jpg`;
      const imageRef = ref(storage, path);
      try {
        await deleteObject(imageRef);
      } catch {}
      const task = uploadBytesResumable(imageRef, file);
      await new Promise<void>((resolve, reject) => {
        task.on("state_changed", null, reject, () => resolve());
      });
      updateProgress();
      const url = (await getDownloadURL(imageRef)) + bust;
      return url;
    };

    const uploadVideoFile = async (file: File) => {
      const videoRef = ref(
        storage,
        `videos/public/${siteKey}/homeBackground.mp4`,
      );

      try {
        await deleteObject(videoRef);
      } catch {}

      const task = uploadBytesResumable(videoRef, file, {
        contentType: file.type,
      });

      await new Promise<void>((resolve, reject) => {
        task.on("state_changed", null, reject, () => resolve());
      });

      updateProgress();

      const downloadURL = (await getDownloadURL(videoRef)) + bust;

      let posterUrl: string | undefined;
      let durationSec: number | undefined;

      try {
        const objectUrl = URL.createObjectURL(file);
        const video = document.createElement("video");
        video.preload = "metadata";
        video.src = objectUrl;
        video.muted = true;
        video.playsInline = true;

        durationSec = await new Promise<number | undefined>(
          (resolve, reject) => {
            video.onloadedmetadata = () => {
              resolve(
                isFinite(video.duration)
                  ? Math.round(video.duration)
                  : undefined,
              );
            };
            video.onerror = () =>
              reject(new Error("動画メタデータの読み込みに失敗"));
          },
        );

        const seekTo = Math.min(1, Math.max(0.1, (video.duration || 1) * 0.1));
        await new Promise<void>((resolve, reject) => {
          video.currentTime = seekTo;
          video.onseeked = () => resolve();
          video.onerror = () => reject(new Error("動画シークに失敗"));
        });

        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const blob: Blob = await new Promise((resolve, reject) =>
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error("ポスター生成に失敗"))),
            "image/jpeg",
            0.82,
          ),
        );

        const posterRef = ref(
          storage,
          `videos/public/${siteKey}/homeBackground.jpg`,
        );
        try {
          await deleteObject(posterRef);
        } catch {}

        const posterTask = uploadBytesResumable(posterRef, blob, {
          contentType: "image/jpeg",
        });
        await new Promise<void>((resolve, reject) => {
          posterTask.on("state_changed", null, reject, () => resolve());
        });
        posterUrl = (await getDownloadURL(posterRef)) + bust;
      } catch (e) {
        console.warn("ポスター生成に失敗。フォールバックを使用します:", e);
      }

      return { videoUrl: downloadURL, posterUrl, durationSec };
    };

    try {
      let imageUploadIndex = 0;

      for (const m of items) {
        if (m.type === "image") {
          if (m.mode === "existing" && m.src) {
            newHeroItems.push({ type: "image", src: m.src });
          } else if (m.mode === "new" && m.file) {
            const url = await uploadImageFile(m.file, imageUploadIndex);
            imageUploadIndex += 1;
            newHeroItems.push({ type: "image", src: url });
          }
        } else if (m.type === "video") {
          if (m.mode === "existing" && m.src) {
            newHeroItems.push({ type: "video", src: m.src });
            heroVideoMetaNext = heroVideoMeta;
          } else if (m.mode === "new" && m.file) {
            const { videoUrl, posterUrl, durationSec } = await uploadVideoFile(
              m.file,
            );
            newHeroItems.push({ type: "video", src: videoUrl });

            heroVideoMetaNext = {
              name: `${siteKey} 紹介動画`,
              description: "サービス紹介動画です。",
              contentUrl: videoUrl,
              uploadDate: new Date().toISOString(),
              ...(posterUrl ? { thumbnailUrl: posterUrl } : {}),
              ...(durationSec
                ? {
                    durationSec,
                    duration: `PT${Math.max(1, durationSec)}S`,
                  }
                : {}),
            };
          }
        }
      }

      const hasVideo = newHeroItems.some((m) => m.type === "video");

      const updateData: any = {
        themeGradient: theme,
        heroItems: newHeroItems,
      };

      if (newHeroItems.length === 1) {
        const only = newHeroItems[0];
        updateData.type = only.type;
        if (only.type === "video") {
          updateData.url = only.src;
          updateData.imageUrls = deleteField();
        } else {
          updateData.url = deleteField();
          updateData.imageUrls = [only.src];
        }
      } else {
        updateData.type = deleteField();
        updateData.url = deleteField();
        updateData.imageUrls = newHeroItems
          .filter((m) => m.type === "image")
          .map((m) => m.src);
      }

      if (hasVideo && (heroVideoMetaNext || heroVideoMeta)) {
        updateData.heroVideo = heroVideoMetaNext || heroVideoMeta;
      } else {
        updateData.heroVideo = deleteField();
      }

      await setDoc(META_REF, updateData, { merge: true });

      setHeroItems(newHeroItems);
      setHeroVideoMeta(
        hasVideo ? heroVideoMetaNext || heroVideoMeta : undefined,
      );

      setProgress(null);
      setEditing(false);
      alert("背景メディアを更新しました！");
    } catch (e) {
      console.error("背景メディアの更新に失敗:", e);
      alert("更新に失敗しました");
      setProgress(null);
    }
  };

  /* 解約予約中ボタン */
  const pendingButton = status === "pending" && isAdmin && (
    <Button
      className="fixed bottom-4 right-4 z-50 bg-yellow-500 text-white shadow-lg"
      onClick={async () => {
        try {
          const res = await fetch("/api/stripe/resume-subscription", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ siteKey: siteKey }),
          });
          if (res.ok) {
            alert("解約予約を取り消しました！");
            location.reload();
          } else {
            alert("再開に失敗しました");
          }
        } catch {
          alert("再開に失敗しました");
        }
      }}
    >
      解約を取り消す
    </Button>
  );

  const initialEditItems: EditMediaItem[] = heroItems.map((item) => ({
    id: item.src,
    type: item.type,
    mode: "existing",
    src: item.src,
  }));
  const heroPoster =
    heroVideoMeta?.thumbnailUrl ||
    heroItems.find((item) => item.type === "image")?.src;

  return (
    <div className="fixed inset-0 top-12">
      {pendingButton}

      {/* ★ heroItems があるときだけ表示。0件なら何も出さない */}
      {heroItems.length > 0 && (
        <div className="absolute inset-0">
          <ProductMedia
            src={heroItems[0].src}
            type={heroItems[0].type}
            items={heroItems}
            fill
            autoPlay
            muted
            alt="背景メディア"
            videoDisplay="play"
            videoPoster={heroPoster}
          />
        </div>
      )}

      {authChecked && isAdmin && (
        <>
          {progress !== null && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
              <BroomDustLoader
                label={`アップロード中… ${progress}%`}
                size={100}
                speed={1}
              />
            </div>
          )}

          <AdminControls
            editing={editing}
            setEditing={setEditing}
            uploading={uploading}
            uploadImage={uploadImage}
            uploadHeaderImage={uploadHeaderImage}
          />

          <MediaEditModal
            open={authChecked && isAdmin && editing}
            uploading={uploading}
            initialItems={initialEditItems}
            onSave={saveHeroMedia}
            onClose={() => {
              if (!uploading) setEditing(false);
            }}
          />
        </>
      )}
    </div>
  );
}
