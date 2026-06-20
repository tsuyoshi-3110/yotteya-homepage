import { CompanyDoc, MediaKind } from "@/types/company";

import { useState } from "react";
import { SITE_KEY } from "@/lib/atoms/siteKeyAtom";
import {
  ref as sRef,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  type FirebaseStorage,
} from "firebase/storage";
import VideoCropperModal from "../media/VideoCropperModal";
import { Trash2, Upload } from "lucide-react";
import { Button } from "../ui/button";
import ImageCropperModal from "../media/ImageCropperModal";
import NextImage from "next/image";

const STORAGE_BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

/** Firebase Storage のダウンロードURLを path に変換（同一バケットのみ対応） */
function urlToStoragePath(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const bucket = STORAGE_BUCKET;
    if (!bucket) return null;
    const apiHost = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/`;
    if (url.startsWith(apiHost)) {
      const pathEnc = url.slice(apiHost.length).split("?")[0];
      return decodeURIComponent(pathEnc);
    }
    if (url.startsWith("gs://")) return url;
  } catch {}
  return null;
}

export function InlineMediaEditor({
  data,
  onChange,
  storage,
}: {
  data: CompanyDoc;
  onChange: (v: CompanyDoc) => void;
  storage: FirebaseStorage;
}) {
  const [isOver, setIsOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  // 画像クロッパー
  const [imgCropOpen, setImgCropOpen] = useState(false);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);

  // 動画クロッパー（ffmpeg.wasm）
  const [videoCropOpen, setVideoCropOpen] = useState(false);
  const [pendingVideoFile, setPendingVideoFile] = useState<File | null>(null);

  // 60秒以内チェック
  const getVideoDuration = (file: File) =>
    new Promise<number>((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const v = document.createElement("video");
      v.preload = "metadata";
      v.onloadedmetadata = () => {
        const d = v.duration || 0;
        URL.revokeObjectURL(url);
        resolve(d);
      };
      v.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("動画のメタデータ読み込みに失敗しました"));
      };
      v.src = url;
    });

  const validateFile = async (file: File) => {
    const isImg = file.type.startsWith("image/");
    const isVid = file.type.startsWith("video/");
    if (!isImg && !isVid) {
      alert("画像または動画ファイルを選択してください。");
      return null;
    }
    const maxBytes = 200 * 1024 * 1024;
    if (file.size > maxBytes) {
      alert("ファイルサイズが大きすぎます（最大200MBまで）。");
      return null;
    }
    if (isVid) {
      try {
        const dur = await getVideoDuration(file);
        if (dur > 60.0) {
          alert("動画は60秒以内にしてください。");
          return null;
        }
      } catch {
        return null;
      }
    }
    return isImg ? ("image" as MediaKind) : ("video" as MediaKind);
  };

  const doUpload = async (file: File, kind: Exclude<MediaKind, null>) => {
    setUploading(true);
    setProgress(0);
    try {
      const ext =
        file.name.split(".").pop() || (kind === "image" ? "jpg" : "mp4");
      const path = `siteMeta/${SITE_KEY}/company/hero/${Date.now()}_${Math.random()
        .toString(36)
        .slice(2)}.${ext}`;
      const storageRef = sRef(storage, path);
      const task = uploadBytesResumable(storageRef, file, {
        contentType: file.type,
        cacheControl: "public,max-age=31536000,immutable",
      });
      await new Promise<void>((resolve, reject) => {
        task.on(
          "state_changed",
          (snap) => {
            const pct = Math.round(
              (snap.bytesTransferred / snap.totalBytes) * 100
            );
            setProgress(pct);
          },
          (err) => reject(err),
          () => resolve()
        );
      });
      const url = await getDownloadURL(storageRef);

      // 旧ファイルがあれば削除（同一バケットのみ）
      if (data.heroMediaUrl) {
        const pathOld = urlToStoragePath(data.heroMediaUrl);
        if (pathOld) {
          try {
            const oldRef = sRef(storage, pathOld);
            await deleteObject(oldRef);
          } catch {}
        }
      }

      onChange({ ...data, heroMediaUrl: url, heroMediaType: kind });
    } catch (e) {
      console.error(e);
      alert(
        "アップロードに失敗しました。権限またはネットワークをご確認ください。"
      );
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  // HEIC/HEIF → JPEG 変換
  const convertIfHeic = async (f: File): Promise<File> => {
    if (typeof window === "undefined") return f;
    const isHeic =
      f.type === "image/heic" ||
      f.type === "image/heif" ||
      /\.heic$/i.test(f.name);
    if (!isHeic) return f;
    const heic2any = (await import("heic2any")).default as any;
    const blob = (await heic2any({ blob: f, toType: "image/jpeg" })) as Blob;
    return new File([blob], f.name.replace(/\.[^.]+$/, ".jpg"), {
      type: "image/jpeg",
    });
  };

  const onFilesArray = async (files: File[]) => {
    if (!files.length) return;
    let file = files[0];

    // iPhone 対策：HEIC/HEIF を先に JPEG へ
    file = await convertIfHeic(file);

    const kind = await validateFile(file);
    if (!kind) return;

    if (kind === "image") {
      setPendingImageFile(file);
      setImgCropOpen(true);
      return;
    }

    // 動画は先にトリミング（スマホ完結）
    setPendingVideoFile(file);
    setVideoCropOpen(true);
  };

  const onDrop: React.DragEventHandler<HTMLDivElement> = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOver(false);
    const dropped = e.dataTransfer?.files
      ? Array.from(e.dataTransfer.files)
      : [];
    await onFilesArray(dropped);
  };

  const onInputChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const input = e.currentTarget;
    const picked = input.files ? Array.from(input.files) : [];
    void (async () => {
      await onFilesArray(picked);
      if (typeof input.value !== "undefined") {
        try {
          input.value = "";
        } catch {}
      }
    })();
  };

  const removeMedia = async () => {
    if (!data.heroMediaUrl) return;
    const ok = confirm("現在のメディアを削除しますか？（保存ボタンで確定）");
    if (!ok) return;
    try {
      const pathOld = urlToStoragePath(data.heroMediaUrl);
      if (pathOld) {
        const r = sRef(storage, pathOld);
        await deleteObject(r);
      }
    } catch {
    } finally {
      onChange({ ...data, heroMediaUrl: "", heroMediaType: null });
    }
  };

  // 画像クロップ確定：Blob → File にしてアップロード
  const handleImageCropped = async (blob: Blob) => {
    if (!pendingImageFile) return;
    setImgCropOpen(false);
    const ext = pendingImageFile.name.split(".").pop() || "jpg";
    const name =
      pendingImageFile.name.replace(/\.[^.]+$/, "") + "_cropped." + ext;
    const file = new File([blob], name, {
      type: pendingImageFile.type || "image/jpeg",
    });
    setPendingImageFile(null);
    await doUpload(file, "image");
  };

  // 動画クロップ確定：Blob → File にしてアップロード
  const handleVideoCropped = async (blob: Blob) => {
    if (!pendingVideoFile) return;
    setVideoCropOpen(false);
    const name = pendingVideoFile.name.replace(/\.[^.]+$/, "") + "_cropped.mp4";
    const file = new File([blob], name, {
      type: "video/mp4",
      lastModified: Date.now(),
    });
    setPendingVideoFile(null);
    await doUpload(file, "video");
  };

  return (
    <div className="px-6 md:px-8 pb-2">
      {/* 画像クロップモーダル（1:1） */}
      {pendingImageFile && (
        <ImageCropperModal
          file={pendingImageFile}
          open={imgCropOpen}
          title="画像のトリミング（1:1）"
          onCancel={() => {
            setImgCropOpen(false);
            setPendingImageFile(null);
          }}
          onCropped={handleImageCropped}
        />
      )}

      {/* 動画クロップモーダル（1:1 / ffmpeg.wasm 書き出し） */}
      {pendingVideoFile && (
        <VideoCropperModal
          open={videoCropOpen}
          file={pendingVideoFile}
          onCancel={() => {
            setVideoCropOpen(false);
            setPendingVideoFile(null);
          }}
          onCropped={handleVideoCropped}
        />
      )}

      <div
        className={[
          "relative w-full overflow-hidden rounded border bg-slate-100",
          isOver ? "ring-2 ring-purple-500" : "ring-1 ring-black/5",
        ].join(" ")}
        style={{ aspectRatio: "1 / 1" }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsOver(true);
        }}
        onDragLeave={() => setIsOver(false)}
        onDrop={onDrop}
      >
        {!data.heroMediaUrl ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500">
            <Upload className="h-8 w-8 mb-2" />
            <div className="text-xs mt-1">
              画像（トリミング可）または60秒以内の動画（最大200MB）
            </div>
          </div>
        ) : data.heroMediaType === "video" ? (
          <video
            src={data.heroMediaUrl ?? undefined}
            className="absolute inset-0 h-full w-full object-cover"
            autoPlay
            muted
            playsInline
            loop
            controls
          />
        ) : (
          <NextImage
            src={data.heroMediaUrl ?? ""}
            alt="company-hero"
            fill
            className="object-cover"
            sizes="100vw"
            unoptimized
          />
        )}

        {/* アクションバー */}
        <div className="absolute bottom-3 right-3 flex items-center gap-2">
          <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-white/90 backdrop-blur border shadow cursor-pointer text-sm">
            <Upload className="h-4 w-4" />
            <span>ファイル選択</span>
            <input
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={onInputChange}
            />
          </label>
          {data.heroMediaUrl && (
            <Button
              variant="secondary"
              onClick={removeMedia}
              className="bg-white/90 text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              削除
            </Button>
          )}
        </div>

        {/* 進捗バー */}
        {uploading && (
          <div className="absolute left-0 right-0 bottom-0 h-1 bg-white/50">
            <div
              className="h-1 bg-purple-600 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      <p className="mt-2 text-xs text-black">
        ※ 画像・動画ともにアップロード前に 1:1
        でトリミングできます（動画は端末内で再エンコード）。
      </p>
    </div>
  );
}
