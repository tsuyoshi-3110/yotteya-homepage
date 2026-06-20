"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  collection,
  getDocs,
  orderBy,
  query,
  doc,
  deleteDoc,
  updateDoc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import MenuItemCard from "./MenuItemCard";
import { Button } from "@/components/ui/button";
import {
  getStorage,
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  type UploadTask,
} from "firebase/storage";

import clsx from "clsx";
import { SITE_KEY } from "@/lib/atoms/siteKeyAtom";
import ProductMedia from "@/components/ProductMedia";

import { useUILang } from "@/lib/atoms/uiLangAtom";
import { LANGS, type LangKey } from "@/lib/langs";
import { BusyOverlay } from "../BusyOverlay";
import { v4 as uuid } from "uuid";
import { IMAGE_MIME_TYPES, VIDEO_MIME_TYPES } from "@/lib/fileTypes";
import { getExt, getVideoMetaFromFile } from "@/lib/media";
import { animations, transition } from "@/lib/animation";

type MediaType = "image" | "video";

/* ===== 型 ===== */
type MenuItem = {
  id: string;
  name: string;
  description?: string;
  price?: number | null;
  isTaxIncluded?: boolean;
  order: number;
  base?: { name: string; description?: string };
  t?: Array<{ lang: LangKey; name?: string; description?: string }>;
};

export type Section = {
  id: string;
  title: string;
  order: number;
  siteKey: string;
  mediaType?: MediaType | null;
  mediaUrl?: string | null;
  mediaItems?: { url: string; type: MediaType }[];
};

type TrItem = { lang: LangKey; name?: string; description?: string };
type TrTitle = { lang: LangKey; title: string };

type EditableMediaItem = {
  id: string;
  type: MediaType;
  file?: File;
  url?: string;
};

type SelectedRow = {
  id: string;
  type: MediaType;
  label: string;
  index: number;
};

const MAX_IMAGES = 3;
const MAX_VIDEOS = 1;
const MAX_VIDEO_SEC = 60;

/* ===== ローカライズ表示 ===== */
function pickItemLocalized(
  it: MenuItem,
  uiLang: ReturnType<typeof useUILang>["uiLang"]
) {
  if (uiLang === "ja") {
    return {
      name: it.base?.name ?? it.name ?? "",
      description: it.base?.description ?? it.description ?? "",
    };
  }
  const hit = it.t?.find((x) => x.lang === uiLang);
  return {
    name: hit?.name ?? it.base?.name ?? it.name ?? "",
    description:
      hit?.description ?? it.base?.description ?? it.description ?? "",
  };
}

/* ===== 翻訳APIラッパ ===== */
async function translateAllTitle(titleJa: string): Promise<TrTitle[]> {
  const jobs = LANGS.map(async (l) => {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: titleJa, body: " ", target: l.key }),
    });
    if (!res.ok) throw new Error("translate error");
    const data = (await res.json()) as { title?: string };
    return { lang: l.key as LangKey, title: (data.title ?? "").trim() };
  });

  const settled = await Promise.allSettled(jobs);
  const out: TrTitle[] = [];
  for (const r of settled) {
    if (r.status === "fulfilled") out.push(r.value);
  }
  return out;
}

async function translateAllItem(
  nameJa: string,
  descJa: string
): Promise<TrItem[]> {
  const jobs = LANGS.map(async (l) => {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: nameJa,
        body: descJa || " ",
        target: l.key,
      }),
    });
    if (!res.ok) throw new Error("translate error");
    const data = (await res.json()) as { title?: string; body?: string };
    return {
      lang: l.key as LangKey,
      name: (data.title ?? "").trim(),
      description: (data.body ?? "").trim(),
    };
  });

  const settled = await Promise.allSettled(jobs);
  const out: TrItem[] = [];
  for (const r of settled) {
    if (r.status === "fulfilled") out.push(r.value);
  }
  return out;
}

/* ===== Base抽出 ===== */
function extractBaseTitle(s: string) {
  return (s || "").split("\n")[0]?.trim() ?? "";
}
function extractBaseBody(s: string) {
  const m = (s || "").split(/\n{2,}/);
  return (m[0] || "").trim();
}

/* ===== 本体 ===== */
export default function MenuSectionCard({
  section,
  onSectionPatch,
  onDeleteSection,
  isLoggedIn,
}: {
  section: Section;
  onSectionPatch?: (patch: Partial<Section>) => void;
  onDeleteSection: () => void;
  isLoggedIn: boolean;
}) {
  const { uiLang } = useUILang();

  const [items, setItems] = useState<MenuItem[]>([]);
  const [showEditSectionModal, setShowEditSectionModal] = useState(false);
  const [newTitle, setNewTitle] = useState(section?.title ?? "");
  const [savingTitle, setSavingTitle] = useState(false);

  // メディア編集用
  const [editMediaItems, setEditMediaItems] = useState<EditableMediaItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const uploadTaskRef = useRef<UploadTask | null>(null);

  // 統一アイテムモーダル
  const [itemModal, setItemModal] = useState<{
    open: boolean;
    mode: "create" | "edit";
    target?: MenuItem | null;
  }>({ open: false, mode: "create", target: null });

  useEffect(
    () => setNewTitle(section?.title ?? ""),
    [section?.id, section?.title]
  );

  /* ===== セクション／アイテム取得 ===== */
  useEffect(() => {
    (async () => {
      const qy = query(
        collection(db, `menuSections/${section.id}/items`),
        orderBy("order", "asc")
      );
      const snap = await getDocs(qy);
      const rows = snap.docs.map((d) => {
        const data = d.data() as any;
        const base = data.base ?? {
          name: data.name ?? "",
          description: data.description ?? "",
        };
        const t: MenuItem["t"] = Array.isArray(data.t)
          ? data.t.map((x: any) => ({
              lang: x.lang as LangKey,
              name: (x.name ?? "").trim(),
              description: (x.description ?? "").trim(),
            }))
          : [];
        return {
          id: d.id,
          name: data.name ?? base.name,
          description: data.description ?? base.description,
          price: data.price ?? null,
          isTaxIncluded: data.isTaxIncluded ?? true,
          order: data.order ?? 9999,
          base,
          t,
        } as MenuItem;
      });
      setItems(rows);
    })();
  }, [section.id]);

  /* ===== セクション削除 ===== */
  const handleDeleteSection = async () => {
    if (!confirm("このセクションを削除しますか？")) return;
    try {
      // 旧単体メディアの削除（mediaUrl）
      if (section.mediaUrl) {
        try {
          const sref = storageRef(getStorage(), section.mediaUrl);
          await deleteObject(sref);
        } catch {
          /* noop */
        }
      }

      // 複数メディアの削除（mediaItems）
      if (Array.isArray(section.mediaItems)) {
        for (const m of section.mediaItems) {
          try {
            const sref = storageRef(getStorage(), m.url);
            await deleteObject(sref);
          } catch {
            /* noop */
          }
        }
      }

      await deleteDoc(doc(db, "menuSections", section.id));
      onDeleteSection();
    } catch {
      alert("セクションの削除に失敗しました。");
    }
  };

  /* ===== セクション名 + メディア保存 ===== */
  const handleSaveSection = async () => {
    const trimmed = newTitle.trim();
    if (!trimmed) return alert("セクション名を入力してください");

    // メディア数チェック
    const imageCount = editMediaItems.filter((m) => m.type === "image").length;
    const videoCount = editMediaItems.filter((m) => m.type === "video").length;
    if (imageCount > MAX_IMAGES || videoCount > MAX_VIDEOS) {
      alert("画像は最大3枚・動画は1本までです");
      return;
    }

    try {
      setSavingTitle(true);
      setUploading(true);

      // 1) タイトル翻訳
      let tTitle: TrTitle[] = [];
      try {
        tTitle = await translateAllTitle(trimmed);
      } catch {
        tTitle = [];
      }
      const titleI18n: Record<string, string> = { ja: trimmed };
      tTitle.forEach((t) => {
        if (t.title) titleI18n[t.lang] = t.title;
      });

      // 2) メディアアップロード
      const uploaded: { url: string; type: MediaType }[] = [];
      const prevUrls = new Set<string>();

      if (Array.isArray(section.mediaItems)) {
        section.mediaItems.forEach((m) => prevUrls.add(m.url));
      } else if (section.mediaUrl) {
        prevUrls.add(section.mediaUrl);
      }

      const storage = getStorage();
      setUploadPercent(0);
      setUploadOpen(true);

      for (let index = 0; index < editMediaItems.length; index++) {
        const item = editMediaItems[index];

        // 既存URLのみの場合はそのまま利用
        if (!item.file && item.url) {
          uploaded.push({ url: item.url, type: item.type });
          continue;
        }

        if (!item.file) continue;
        const f = item.file;
        const type = item.type;

        const isImage = IMAGE_MIME_TYPES.includes(f.type);
        const isVideo = VIDEO_MIME_TYPES.includes(f.type);
        if (!isImage && !isVideo) {
          alert("対応していないファイル形式です");
          throw new Error("invalid file");
        }

        if (isVideo) {
          const meta = await getVideoMetaFromFile(f);
          if (meta.duration > MAX_VIDEO_SEC + 1) {
            alert(`動画は ${MAX_VIDEO_SEC} 秒以内にしてください`);
            throw new Error("video too long");
          }
        }

        const ext = getExt(f.name) || (type === "image" ? "jpg" : "mp4");
        const path = `sections/${SITE_KEY}/${section.id}/${index + 1}.${ext}`;
        const sref = storageRef(storage, path);

        const task = uploadBytesResumable(sref, f, {
          contentType: f.type,
        });
        uploadTaskRef.current = task;

        await new Promise<void>((resolve, reject) => {
          task.on(
            "state_changed",
            (snap) => {
              const pct = (snap.bytesTransferred / snap.totalBytes) * 100;
              const overall =
                ((index + pct / 100) / editMediaItems.length) * 100 || 0;
              setUploadPercent(overall);
            },
            (err) => reject(err),
            () => resolve()
          );
        });

        const url = await getDownloadURL(task.snapshot.ref);
        uploaded.push({ url, type });
      }

      const primary = uploaded[0];

      // 3) Firestore更新
      await updateDoc(doc(db, "menuSections", section.id), {
        title: trimmed,
        baseTitle: { title: trimmed },
        tTitle,
        titleI18n,
        mediaType: primary?.type ?? null,
        mediaUrl: primary?.url ?? null,
        mediaItems: uploaded,
        updatedAt: serverTimestamp(),
      });

      // 4) 不要になった旧メディアの削除
      const nextUrls = new Set<string>(uploaded.map((m) => m.url));
      for (const url of prevUrls) {
        if (!nextUrls.has(url)) {
          try {
            const sref = storageRef(storage, url);
            await deleteObject(sref);
          } catch {
            /* noop */
          }
        }
      }

      // ローカル反映
      onSectionPatch?.({
        title: titleI18n[uiLang] ?? titleI18n.ja ?? trimmed,
        mediaType: primary?.type ?? null,
        mediaUrl: primary?.url ?? null,
        mediaItems: uploaded,
      });

      setShowEditSectionModal(false);
    } catch {
      alert("セクションの保存に失敗しました。");
    } finally {
      setSavingTitle(false);
      setUploading(false);
      setUploadOpen(false);
      uploadTaskRef.current = null;
    }
  };

  /* ===== メディア選択（編集用） ===== */
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  const pickImage = () => imageInputRef.current?.click();
  const pickVideo = () => videoInputRef.current?.click();

  useEffect(() => {
    if (!showEditSectionModal) return;

    const rawItems =
      ((section as any).mediaItems as { url: string; type: MediaType }[]) ??
      undefined;

    let items: EditableMediaItem[] = [];

    if (Array.isArray(rawItems) && rawItems.length > 0) {
      items = rawItems.map((m) => ({
        id: uuid(),
        url: m.url,
        type: (m.type as MediaType) || "image",
      }));
    } else if (section.mediaUrl) {
      items = [
        {
          id: uuid(),
          url: section.mediaUrl,
          type: (section.mediaType as MediaType) || "image",
        },
      ];
    }
    setEditMediaItems(items);
  }, [showEditSectionModal, section]);

  const imageCount = useMemo(
    () => editMediaItems.filter((m) => m.type === "image").length,
    [editMediaItems]
  );
  const videoCount = useMemo(
    () => editMediaItems.filter((m) => m.type === "video").length,
    [editMediaItems]
  );
  const canAddImage = imageCount < MAX_IMAGES;
  const canAddVideo = videoCount < MAX_VIDEOS;

  const handleAddImagesEdit = (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files).filter((f) =>
      IMAGE_MIME_TYPES.includes(f.type)
    );
    if (!arr.length) return;

    setEditMediaItems((prev) => {
      const currentImages = prev.filter((m) => m.type === "image").length;
      const remain = MAX_IMAGES - currentImages;
      if (remain <= 0) {
        alert("画像は最大3枚までです");
        return prev;
      }
      const toAdd = arr.slice(0, remain).map<EditableMediaItem>((file) => ({
        id: uuid(),
        file,
        type: "image",
      }));

      const videoIndex = prev.findIndex((m) => m.type === "video");
      if (videoIndex === -1) {
        return [...prev, ...toAdd];
      }
      const head = prev.slice(0, videoIndex);
      const tail = prev.slice(videoIndex);
      return [...head, ...toAdd, ...tail];
    });
  };

  const handleAddVideoEdit = async (file: File | null) => {
    if (!file) return;
    if (!VIDEO_MIME_TYPES.includes(file.type)) {
      alert("対応していない動画形式です");
      return;
    }

    try {
      const meta = await getVideoMetaFromFile(file);
      if (meta.duration > MAX_VIDEO_SEC + 1) {
        alert(`動画は ${MAX_VIDEO_SEC} 秒以内にしてください`);
        return;
      }
    } catch {
      alert("動画情報の取得に失敗しました");
      return;
    }

    setEditMediaItems((prev) => {
      const hasVideo = prev.some((m) => m.type === "video");
      if (hasVideo) {
        alert("動画は1つまでです");
        return prev;
      }
      return [
        ...prev,
        {
          id: uuid(),
          file,
          type: "video",
        },
      ];
    });
  };

  const moveMedia = (from: number, to: number) => {
    setEditMediaItems((prev) => {
      if (from === to) return prev;
      if (from < 0 || to < 0 || from >= prev.length || to >= prev.length)
        return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const selectedMediaRows: SelectedRow[] = editMediaItems.map((m, idx) => ({
    id: m.id,
    type: m.type,
    label: m.file ? m.file.name : m.url ?? "(未設定)",
    index: idx,
  }));

  const cancelUpload = () => {
    try {
      uploadTaskRef.current?.cancel();
    } finally {
      setUploadOpen(false);
      setUploading(false);
    }
  };

  const mediaNode = useMemo(() => {
    const items: { src: string; type: MediaType }[] =
      Array.isArray(section.mediaItems) && section.mediaItems.length > 0
        ? section.mediaItems.map((m) => ({
            src: m.url,
            type: m.type,
          }))
        : section.mediaUrl
        ? [
            {
              src: section.mediaUrl,
              type: (section.mediaType as MediaType) || "image",
            },
          ]
        : [];

    if (!items.length) return null;

    const primary = items[0];

    return (
      <ProductMedia
        src={primary.src}
        type={primary.type}
        items={items}
        className="mb-3 rounded-lg shadow-sm"
        alt={`${section.title} のメディア`}
      />
    );
  }, [section.mediaItems, section.mediaUrl, section.mediaType, section.title]);

  /* ===== 画面 ===== */
  return (
    <>
      <motion.div
        className="bg-white/50 backdrop-blur-sm shadow-md p-4 rounded mb-6"
        initial={animations.fadeInUp.initial}
        whileInView={animations.fadeInUp.animate}
        transition={transition.slow}
        viewport={{ once: true, amount: 0.3 }}
      >
        {isLoggedIn && (
          <div className="flex gap-2 flex-wrap mt-6 mb-6">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowEditSectionModal(true)}
            >
              ✎ セクション名/メディア
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleDeleteSection}
            >
              セクション削除
            </Button>
          </div>
        )}

        <h2
          className={clsx(
            "text-xl font-semibold mb-4 whitespace-pre-wrap",
            "text-black"
          )}
        >
          {section.title}
        </h2>

        {mediaNode}

        {items.map((item, index) => {
          const loc = pickItemLocalized(item, uiLang);
          return (
            <motion.div
              key={item.id}
              initial={animations.fadeInUp.initial}
              whileInView={animations.fadeInUp.animate}
              transition={{ ...transition.normal, delay: index * 0.08 }}
              viewport={{ once: true, amount: 0.3 }}
            >
              <MenuItemCard
                item={{ ...item, name: loc.name, description: loc.description }}
                isLoggedIn={isLoggedIn}
                onDelete={async () => {
                  if (!confirm("このメニューを削除しますか？")) return;
                  await deleteDoc(
                    doc(db, `menuSections/${section.id}/items`, item.id)
                  );
                  setItems((prev) => prev.filter((it) => it.id !== item.id));
                }}
                onEdit={(it) =>
                  setItemModal({
                    open: true,
                    mode: "edit",
                    target: it,
                  })
                }
              />
            </motion.div>
          );
        })}

        {isLoggedIn && (
          <Button
            size="sm"
            className="mt-2"
            onClick={() =>
              setItemModal({ open: true, mode: "create", target: null })
            }
          >
            ＋ メニュー追加
          </Button>
        )}
      </motion.div>

      {/* セクション名編集＋メディア編集モーダル（画像3＋動画1・並べ替え可） */}
      {showEditSectionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-sm max-h-[90vh] overflow-y-auto relative">
            <BusyOverlay saving={savingTitle} />
            <h2 className="text-lg font-bold mb-4">セクションを編集</h2>
            <label className="text-sm font-medium">セクション名</label>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="mb-4 mt-1 w-full border px-3 py-2 rounded"
              disabled={uploading || savingTitle}
            />

            {/* メディア編集 */}
            <div className="space-y-2 mb-3">
              <div className="text-sm font-medium mb-1">
                メディア（画像 最大3枚・動画 最大1つ）
              </div>

              {/* 画像追加 */}
              <div className="flex flex-col gap-1">
                <span className="text-xs text-gray-600">
                  画像を追加（残り {Math.max(0, MAX_IMAGES - imageCount)} 枚）
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={pickImage}
                  disabled={uploading || savingTitle || !canAddImage}
                >
                  画像を選択
                </Button>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept={IMAGE_MIME_TYPES.join(",")}
                  multiple
                  hidden
                  onChange={(e) => {
                    handleAddImagesEdit(e.target.files);
                    if (e.target) e.target.value = "";
                  }}
                />
              </div>

              {/* 動画追加 */}
              <div className="flex flex-col gap-1">
                <span className="text-xs text-gray-600">
                  動画を追加（最大1つ・{MAX_VIDEO_SEC}秒まで）
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={pickVideo}
                  disabled={uploading || savingTitle || !canAddVideo}
                >
                  動画を選択
                </Button>
                <input
                  ref={videoInputRef}
                  type="file"
                  accept={VIDEO_MIME_TYPES.join(",")}
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    handleAddVideoEdit(f);
                    if (e.target) e.target.value = "";
                  }}
                />
              </div>

              {/* 選択中メディア一覧 */}
              {selectedMediaRows.length > 0 && (
                <div className="mt-3 space-y-1">
                  <p className="text-sm font-semibold">選択中のメディア</p>
                  {selectedMediaRows.map((row) => (
                    <div
                      key={row.id}
                      className="flex items-center justify-between rounded border px-3 py-2 text-sm bg-gray-50"
                    >
                      <span className="truncate">
                        {row.index + 1}.{" "}
                        {row.type === "image" ? "画像" : "動画"}（{row.label}）
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveMedia(row.index, row.index - 1)}
                          disabled={uploading || savingTitle || row.index === 0}
                          className="text-xs px-1 py-0.5 border rounded bg-white disabled:opacity-40"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => moveMedia(row.index, row.index + 1)}
                          disabled={
                            uploading ||
                            savingTitle ||
                            row.index === selectedMediaRows.length - 1
                          }
                          className="text-xs px-1 py-0.5 border rounded bg-white disabled:opacity-40"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setEditMediaItems((prev) =>
                              prev.filter((_, i) => i !== row.index)
                            )
                          }
                          disabled={uploading || savingTitle}
                          className="text-red-600 text-xs underline disabled:opacity-40"
                        >
                          削除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-between sticky bottom-0 bg-white pt-4">
              <Button
                variant="outline"
                onClick={() =>
                  !uploading && !savingTitle && setShowEditSectionModal(false)
                }
                disabled={uploading || savingTitle}
              >
                閉じる
              </Button>

              <Button
                onClick={handleSaveSection}
                disabled={uploading || savingTitle}
              >
                {savingTitle ? "保存中..." : "保存"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <UploadProgressModal
        open={uploadOpen}
        percent={uploadPercent}
        onCancel={cancelUpload}
        title="メディアをアップロード中…"
      />

      {/* 追加/編集 兼用：統一モーダル（アイテム） */}
      <ItemModal
        open={itemModal.open}
        mode={itemModal.mode}
        initial={
          itemModal.mode === "edit" && itemModal.target
            ? {
                id: itemModal.target.id,
                name:
                  itemModal.target.base?.name ?? itemModal.target.name ?? "",
                description:
                  itemModal.target.base?.description ??
                  itemModal.target.description ??
                  "",
                price:
                  itemModal.target.price == null
                    ? ""
                    : String(itemModal.target.price),
                isTaxIncluded: itemModal.target.isTaxIncluded ?? true,
                order: itemModal.target.order ?? items.length,
              }
            : {
                id: undefined,
                name: "",
                description: "",
                price: "",
                isTaxIncluded: true,
                order: items.length,
              }
        }
        onClose={() => setItemModal((s) => ({ ...s, open: false }))}
        onSaved={(saved) => {
          if (itemModal.mode === "create") {
            setItems((prev) => [...prev, saved as any]);
          } else {
            setItems((prev) =>
              prev.map((it) => (it.id === saved.id ? (saved as any) : it))
            );
          }
          setItemModal((s) => ({ ...s, open: false }));
        }}
        sectionId={section.id}
      />
    </>
  );
}

/* =========================
   アップロード進捗モーダル
========================= */
function UploadProgressModal({
  open,
  percent,
  onCancel,
  title = "アップロード中…",
}: {
  open: boolean;
  percent: number;
  onCancel: () => void;
  title?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50">
      <div className="w-[90%] max-w-sm rounded-lg bg-white p-5 shadow-xl">
        <h2 className="mb-3 text-lg font-semibold">{title}</h2>
        <div className="mb-2 text-sm text-gray-600">{Math.floor(percent)}%</div>
        <div className="h-2 w-full rounded bg-gray-200">
          <div
            className="h-2 rounded bg-blue-500 transition-[width]"
            style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
          />
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded bg-red-500 px-3 py-1.5 text-white hover:bg-red-600"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}

/* ========= ItemModal（AI説明のみ。翻訳UIは無し。保存時に自動翻訳） ========= */
function ItemModal({
  open,
  mode,
  initial,
  onClose,
  onSaved,
  sectionId,
}: {
  open: boolean;
  mode: "create" | "edit";
  initial: {
    id?: string;
    name: string;
    description: string;
    price: string;
    isTaxIncluded: boolean;
    order: number;
  };
  onClose: () => void;
  onSaved: (saved: MenuItem) => void;
  sectionId: string;
}) {
  const [name, setName] = useState(initial.name);
  const [desc, setDesc] = useState(initial.description);
  const [price, setPrice] = useState(initial.price);
  const [isTaxIncluded, setIsTaxIncluded] = useState(initial.isTaxIncluded);

  const [genOpen, setGenOpen] = useState(false);
  const [genKeywords, setGenKeywords] = useState<string[]>(["", "", ""]);
  const [genLoading, setGenLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initial.name);
      setDesc(initial.description);
      setPrice(initial.price);
      setIsTaxIncluded(initial.isTaxIncluded);
      setGenOpen(false);
      setGenKeywords(["", "", ""]);
      setGenLoading(false);
      setSaving(false);
    }
  }, [open, initial]);

  const canOpenGen = (name ?? "").trim().length > 0;
  const canGenerate =
    canOpenGen &&
    genKeywords.some((k) => (k || "").trim()) &&
    !genLoading &&
    !saving;

  const doGenerate = async () => {
    if (!canGenerate) return;
    setGenLoading(true);
    try {
      const res = await fetch("/api/generate-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: (extractBaseTitle(name) || name || "").trim(),
          keywords: genKeywords.map((k) => k.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.body)
        throw new Error(data?.error || "生成に失敗しました");
      const out = String(data.body).trim();
      setDesc(out);
      setGenKeywords(["", "", ""]);
      setGenOpen(false);
    } catch {
      alert("説明文の生成に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setGenLoading(false);
    }
  };

  const save = async () => {
    if (saving) return;
    const nameJa = extractBaseTitle(name).trim() || name.trim();
    const descJa = extractBaseBody(desc).trim() || desc.trim();
    if (!nameJa) return alert("名前は必須です");

    const priceNum =
      price.trim() === ""
        ? null
        : Number.isNaN(Number(price))
        ? null
        : Number(price);

    setSaving(true);
    try {
      let t: TrItem[] = [];
      try {
        t = await translateAllItem(nameJa, descJa);
      } catch {
        /* noop */
      }

      const base = { name: nameJa, ...(descJa && { description: descJa }) };

      if (mode === "create") {
        const refDoc = await addDoc(
          collection(db, `menuSections/${sectionId}/items`),
          {
            base,
            t,
            name: base.name,
            ...(base.description && { description: base.description }),
            price: priceNum,
            isTaxIncluded,
            order: initial.order,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }
        );

        onSaved({
          id: refDoc.id,
          name: base.name,
          description: base.description,
          price: priceNum,
          isTaxIncluded,
          order: initial.order,
          base,
          t,
        });
      } else {
        if (!initial.id) return;
        await updateDoc(
          doc(db, `menuSections/${sectionId}/items`, initial.id),
          {
            base,
            t,
            name: base.name,
            ...(base.description && { description: base.description }),
            price: priceNum,
            isTaxIncluded,
            updatedAt: serverTimestamp(),
          }
        );
        onSaved({
          id: initial.id,
          name: base.name,
          description: base.description,
          price: priceNum,
          isTaxIncluded,
          order: initial.order,
          base,
          t,
        });
      }
    } catch {
      alert("保存に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1002] flex items-center justify-center bg-black/50"
      onClick={() => (!saving ? onClose() : undefined)}
    >
      <div
        className="w-full max-w-sm bg-white rounded-lg shadow-xl p-5 relative"
        onClick={(e) => e.stopPropagation()}
        aria-busy={saving}
      >
        <BusyOverlay saving={saving} />

        <h3 className="text-lg font-bold mb-4">
          {mode === "create" ? "メニューを追加" : "メニューを編集"}
        </h3>

        <input
          placeholder="サービス名"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mb-2 w-full border px-3 py-2 rounded"
          disabled={saving}
        />
        <textarea
          placeholder="サービス内容"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          rows={4}
          className="w-full border px-3 py-2 rounded mb-3"
          disabled={saving}
        />

        {/* AI説明のみ */}
        <div className="flex flex-col gap-2 mb-3">
          <button
            type="button"
            disabled={!canOpenGen || saving}
            onClick={() => setGenOpen((v) => !v)}
            className={clsx(
              "w-full rounded px-4 py-2 text-white",
              canOpenGen && !saving
                ? "bg-purple-600 hover:bg-purple-700"
                : "bg-purple-400 cursor-not-allowed"
            )}
          >
            AIで説明を作成
          </button>
        </div>

        {genOpen && (
          <div className="rounded-lg border p-3 mb-3">
            <p className="text-sm text-gray-600 mb-2">
              タイトル：
              <span className="font-medium">{name || "（未入力）"}</span>
            </p>
            <p className="text-xs text-gray-500 mb-2">
              キーワードを1〜3個入力（1つ以上で生成可能）
            </p>
            {[0, 1, 2].map((i) => (
              <input
                key={i}
                type="text"
                placeholder={`キーワード${i + 1}`}
                value={genKeywords[i] || ""}
                onChange={(e) => {
                  const next = [...genKeywords];
                  next[i] = e.target.value;
                  setGenKeywords(next);
                }}
                className="w-full border rounded px-3 py-2 text-sm mb-2"
                disabled={genLoading || saving}
              />
            ))}
            <button
              type="button"
              onClick={doGenerate}
              disabled={!canGenerate || saving}
              className={clsx(
                "w-full rounded px-4 py-2 text-white flex items-center justify-center gap-2",
                canGenerate && !saving
                  ? "bg-purple-600 hover:bg-purple-700"
                  : "bg-purple-400 cursor-not-allowed"
              )}
            >
              {genLoading ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    />
                  </svg>
                  生成中…
                </>
              ) : (
                "説明文を生成する"
              )}
            </button>
          </div>
        )}

        <input
          placeholder="価格（例：5500）(任意)"
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="mb-2 w-full border px-3 py-2 rounded"
          disabled={saving}
        />
        <div className="flex gap-4 mb-4 text-sm">
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="tax"
              checked={isTaxIncluded}
              onChange={() => setIsTaxIncluded(true)}
              disabled={saving}
            />
            税込
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="tax"
              checked={!isTaxIncluded}
              onChange={() => setIsTaxIncluded(false)}
              disabled={saving}
            />
            税別
          </label>
        </div>

        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => !saving && onClose()}
            disabled={saving}
          >
            キャンセル
          </Button>
          <Button onClick={save} disabled={saving || genLoading}>
            {saving ? "保存中..." : mode === "create" ? "追加" : "保存"}
          </Button>
        </div>
      </div>
    </div>
  );
}
