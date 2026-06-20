// src/components/MediaEditModal.tsx
"use client";

import React, { useEffect, useState } from "react";
import { v4 as uuid } from "uuid";

export type MediaType = "image" | "video";

export type EditMediaItem = {
  id: string;
  type: MediaType;
  mode: "existing" | "new"; // 既存 or 新規
  src?: string;             // 既存用
  file?: File;              // 新規用
};

const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const VIDEO_MIME_TYPES = ["video/mp4", "video/quicktime"] as const;
const MAX_VIDEO_SEC = 60;

interface Props {
  open: boolean;
  uploading: boolean;
  initialItems: EditMediaItem[];
  onSave: (items: EditMediaItem[]) => void;
  onClose: () => void;
}

export default function MediaEditModal({
  open,
  uploading,
  initialItems,
  onSave,
  onClose,
}: Props) {
  const [items, setItems] = useState<EditMediaItem[]>([]);

  useEffect(() => {
    if (open) {
      setItems(
        initialItems.map((it) => ({
          ...it,
          mode: it.mode ?? "existing",
        }))
      );
    }
  }, [open, initialItems]);

  if (!open) return null;

  const imageCount = items.filter((m) => m.type === "image").length;
  const videoCount = items.filter((m) => m.type === "video").length;

  // ★ 動画1 + 画像3 選択中かどうか
  const isFull = imageCount >= 3 && videoCount >= 1;

  const handleAddImages: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const files = Array.from(e.target.files ?? []).filter((f) =>
      IMAGE_MIME_TYPES.includes(f.type)
    );
    e.target.value = "";

    if (!files.length) return;

    const remain = 3 - imageCount;
    if (remain <= 0) {
      alert("画像は最大3枚までです");
      return;
    }

    const toAdd = files.slice(0, remain).map<EditMediaItem>((file) => ({
      id: uuid(),
      type: "image",
      mode: "new",
      file,
    }));

    setItems((prev) => [...prev, ...toAdd]);
  };

  const handleAddVideo: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;

    if (!VIDEO_MIME_TYPES.includes(f.type as any)) {
      alert("対応していない動画形式です（mp4 推奨）");
      return;
    }
    if (videoCount >= 1) {
      alert("動画は1本までです");
      return;
    }

    const blobURL = URL.createObjectURL(f);
    const vid = document.createElement("video");
    vid.preload = "metadata";
    vid.src = blobURL;
    vid.onloadedmetadata = () => {
      const duration = vid.duration;
      URL.revokeObjectURL(blobURL);

      if (isFinite(duration) && duration > MAX_VIDEO_SEC) {
        alert(`動画は ${MAX_VIDEO_SEC} 秒以内にしてください`);
        return;
      }

      setItems((prev) => [
        ...prev,
        {
          id: uuid(),
          type: "video",
          mode: "new",
          file: f,
        },
      ]);
    };
    vid.onerror = () => {
      URL.revokeObjectURL(blobURL);
      alert("動画の読み込みに失敗しました");
    };
  };

  const moveRow = (from: number, to: number) => {
    setItems((prev) => {
      const total = prev.length;
      if (to < 0 || to >= total) return prev;
      const clone = [...prev];
      const [removed] = clone.splice(from, 1);
      clone.splice(to, 0, removed);
      return clone;
    });
  };

  const removeRow = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // ★ 0件でも OK。上限超えだけチェック
  const handleSave = () => {
    if (items.filter((m) => m.type === "image").length > 3) {
      alert("画像は最大3枚までです");
      return;
    }
    if (items.filter((m) => m.type === "video").length > 1) {
      alert("動画は1本までです");
      return;
    }
    onSave(items);
  };

  const rows = items.map((m, index) => {
    let label = "";
    if (m.mode === "new" && m.file) {
      label = m.file.name;
    } else if (m.src) {
      const last = m.src.split("/").pop() ?? "";
      label = last.split("?")[0] || "(既存メディア)";
    } else {
      label = "(不明なメディア)";
    }
    return { ...m, index, label };
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md bg-white rounded-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-center">メディアを更新</h2>

        <ul className="text-sm text-gray-700 list-disc list-inside">
          <li>動画は1本</li>
          <li>画像は1〜3枚（0枚でも可）</li>
        </ul>

        {isFull && (
          <p className="text-xs text-red-600">
            動画1本・画像3枚が選択済みです。これ以上追加するには、どれかを削除してください。
          </p>
        )}

        {/* 画像選択 */}
        <div className="space-y-1 mt-2">
          <label className="text-sm">画像（最大3枚）</label>
          <input
            type="file"
            multiple
            accept={IMAGE_MIME_TYPES.join(",")}
            onChange={handleAddImages}
            className="bg-gray-500 text-white w-full h-10 px-3 py-1 rounded disabled:opacity-40"
            disabled={uploading || imageCount >= 3 || isFull}
          />
        </div>

        {/* 動画選択 */}
        <div className="space-y-1">
          <label className="text-sm">動画（任意・1本まで）</label>
          <input
            type="file"
            accept={VIDEO_MIME_TYPES.join(",")}
            onChange={handleAddVideo}
            className="bg-gray-500 text-white w-full h-10 px-3 py-1 rounded disabled:opacity-40"
            disabled={uploading || videoCount >= 1 || isFull}
          />
        </div>

        {/* 選択中メディア（並べ替え可） */}
        {rows.length > 0 && (
          <div className="mt-3 space-y-1">
            <p className="text-sm font-semibold">選択中のメディア</p>
            {rows.map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between rounded border px-3 py-2 text-sm bg-gray-50"
              >
                <span className="truncate">
                  {row.index + 1}. {row.type === "image" ? "画像" : "動画"}（
                  {row.label}）
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveRow(row.index, row.index - 1)}
                    disabled={uploading || row.index === 0}
                    className="text-xs px-1 py-0.5 border rounded bg-white disabled:opacity-40"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveRow(row.index, row.index + 1)}
                    disabled={uploading || row.index === rows.length - 1}
                    className="text-xs px-1 py-0.5 border rounded bg-white disabled:opacity-40"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => removeRow(row.index)}
                    disabled={uploading}
                    className="text-red-600 text-xs underline disabled:opacity-40"
                  >
                    削除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 justify-center mt-4">
          <button
            type="button"
            onClick={handleSave}
            disabled={uploading}
            className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
          >
            アップロード
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="px-4 py-2 bg-gray-500 text-white rounded disabled:opacity-50"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}
