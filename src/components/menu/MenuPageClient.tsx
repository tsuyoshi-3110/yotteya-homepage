"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { db, auth } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  orderBy,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  writeBatch,
} from "firebase/firestore";
import MenuSectionCard from "@/components/menu/MenuSectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { onAuthStateChanged } from "firebase/auth";
import { SITE_KEY } from "@/lib/atoms/siteKeyAtom";
import {
  getStorage,
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
  type UploadTask,
} from "firebase/storage";
import { motion, Transition, Variants } from "framer-motion";

import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";

import { v4 as uuid } from "uuid";

import { useUILang, type UILang } from "@/lib/atoms/uiLangAtom";
import { LANGS } from "@/lib/langs";
import { getExt, getVideoMetaFromFile } from "@/lib/media";
import { IMAGE_MIME_TYPES, VIDEO_MIME_TYPES } from "@/lib/fileTypes";

type MediaType = "image" | "video";

/* ===== 見出し・ボタンの多言語 ===== */
const PAGE_TITLE_T: Record<UILang, string> = {
  ja: "料金",
  en: "Pricing",
  zh: "价格",
  "zh-TW": "價格",
  ko: "요금",
  fr: "Tarifs",
  es: "Precios",
  de: "Preise",
  pt: "Preços",
  it: "Prezzi",
  ru: "Цены",
  th: "ราคา",
  vi: "Giá",
  id: "Harga",
  hi: "कीमतें",
  ar: "الأسعار",
};

// 追加：下に貼り替えるための定義
const EASE: Transition["ease"] = [0.16, 1, 0.3, 1];

const titleParent: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.17,   // ←ゆっくり一文字ずつ
      delayChildren: 0.25,
    },
  },
};

const titleChild: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.96 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 1.8,          // ← 表示速度をさらに遅く
      ease: EASE,
    },
  },
};


/* =========================
   Firestore保存用の型
========================= */
type SectionDoc = {
  title?: string;
  titleI18n?: Partial<Record<UILang, string>>;
  baseTitle?: { title: string };
  tTitle?: Array<{ lang: UILang; title?: string }>;
  order: number;
  siteKey: string;
  mediaType?: MediaType | null;
  mediaUrl?: string | null;
  mediaItems?: { url: string; type: MediaType }[];
};

/* UI用 */
export type UIMenuSection = SectionDoc & {
  id: string;
  title: string;
  mediaItems?: { url: string; type: MediaType }[];
};

type SortableChildArgs = {
  attributes: React.HTMLAttributes<HTMLDivElement>;
  listeners: any;
  isDragging: boolean;
};

type SortableItemProps = {
  id: string;
  children: (args: SortableChildArgs) => React.ReactNode;
};

function SortableSectionItem({ id, children }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    transition,
    zIndex: isDragging ? 50 : "auto",
  };

  return (
    <div ref={setNodeRef} style={style}>
      {children({ attributes, listeners, isDragging })}
    </div>
  );
}

/* =========================
   タイトル翻訳ユーティリティ
========================= */
const ALL_UI_LANGS: UILang[] = ["ja", ...LANGS.map((l) => l.key as UILang)];

async function translateTitleOnce(
  text: string,
  target: UILang
): Promise<string> {
  if (target === "ja") return text;
  try {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "", body: text, target }),
    });
    const data = await res.json();
    const out = (data?.body ?? "").trim();
    return out || text;
  } catch {
    return text;
  }
}

/** 日本語タイトルを全UI言語へ翻訳してマップにする */
async function buildTitleI18n(
  baseJa: string
): Promise<Partial<Record<UILang, string>>> {
  const entries = await Promise.all(
    ALL_UI_LANGS.map(
      async (lng) => [lng, await translateTitleOnce(baseJa, lng)] as const
    )
  );
  return Object.fromEntries(entries);
}

/* ===== セクション用フォームメディア ===== */
type FormMediaItem = {
  id: string;
  file: File;
  type: MediaType;
};

const MAX_IMAGES = 3;
const MAX_VIDEOS = 1;
const MAX_VIDEO_SEC = 60;

/* =========================
   本体
========================= */
export default function MenuPageClient() {
  const [sections, setSections] = useState<UIMenuSection[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // 新規追加モーダル用：複数メディア
  const [formMedia, setFormMedia] = useState<FormMediaItem[]>([]);
  const [creating, setCreating] = useState(false);

  // 進捗モーダル
  const [uploadPercent, setUploadPercent] = useState(0);
  const [uploadOpen, setUploadOpen] = useState(false);
  const uploadTaskRef = useRef<UploadTask | null>(null);

  const [showHelp, setShowHelp] = useState(false);

  const { uiLang } = useUILang();
  const pageTitle = PAGE_TITLE_T[uiLang] ?? PAGE_TITLE_T.ja;

  // DnD センサー
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    })
  );

  /* 認証フラグ */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => setIsLoggedIn(!!user));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!showHelp) return;
    const onKey = (e: KeyboardEvent) =>
      e.key === "Escape" && setShowHelp(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showHelp]);

  /* セクション購読 */
  useEffect(() => {
    const qy = query(
      collection(db, "menuSections"),
      where("siteKey", "==", SITE_KEY),
      orderBy("order", "asc")
    );
    const unsub = onSnapshot(qy, (snap) => {
      const rows: UIMenuSection[] = snap.docs.map((d) => {
        const raw = d.data() as SectionDoc;
        const titleI18n: Partial<Record<UILang, string>> = {
          ...(raw.titleI18n ?? {}),
        };

        // tTitle array -> titleI18n へ変換（互換用）
        if (Array.isArray(raw.tTitle)) {
          raw.tTitle.forEach((t) => {
            if (t.lang && t.title) {
              titleI18n[t.lang] = t.title;
            }
          });
        }

        const baseJa = raw.baseTitle?.title ?? raw.title ?? titleI18n.ja ?? "";
        if (baseJa) {
          titleI18n.ja = baseJa;
        }

        const uiTitle =
          titleI18n[uiLang] ??
          titleI18n.ja ??
          raw.title ??
          raw.baseTitle?.title ??
          "";

        const mediaItems: { url: string; type: MediaType }[] =
          Array.isArray(raw.mediaItems) && raw.mediaItems.length > 0
            ? raw.mediaItems
            : raw.mediaUrl && raw.mediaType
            ? [{ url: raw.mediaUrl, type: raw.mediaType }]
            : [];

        return {
          id: d.id,
          ...raw,
          title: uiTitle,
          titleI18n,
          mediaItems,
        };
      });
      setSections(rows);
    });
    return () => unsub();
  }, [uiLang]);

  /* DnD 並び替え確定 */
  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const oldIndex = sections.findIndex((s) => s.id === String(active.id));
    const newIndex = sections.findIndex((s) => s.id === String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;

    const newList = arrayMove(sections, oldIndex, newIndex);
    setSections(newList);

    const batch = writeBatch(db);
    newList.forEach((s, idx) => {
      batch.update(doc(db, "menuSections", s.id), { order: idx });
    });
    await batch.commit();
  };

  const cancelUpload = () => {
    try {
      uploadTaskRef.current?.cancel();
    } finally {
      setUploadOpen(false);
    }
  };

  /* ===== 新規追加：メディア操作 ===== */
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  const pickImages = () => imageInputRef.current?.click();
  const pickVideo = () => videoInputRef.current?.click();

  const handleAddImages = (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files).filter((f) =>
      IMAGE_MIME_TYPES.includes(f.type)
    );
    if (!arr.length) return;

    setFormMedia((prev) => {
      const currentImages = prev.filter((m) => m.type === "image").length;
      const remain = MAX_IMAGES - currentImages;
      if (remain <= 0) {
        alert("画像は最大3枚までです");
        return prev;
      }
      const toAdd = arr.slice(0, remain).map<FormMediaItem>((file) => ({
        id: uuid(),
        file,
        type: "image",
      }));

      // 既存動画があればその直前に画像を挿入して動画を最後に保つ
      const videoIndex = prev.findIndex((m) => m.type === "video");
      if (videoIndex === -1) {
        return [...prev, ...toAdd];
      }
      const head = prev.slice(0, videoIndex);
      const tail = prev.slice(videoIndex);
      return [...head, ...toAdd, ...tail];
    });
  };

  const handleAddVideo = async (file: File | null) => {
    if (!file) return;
    if (!VIDEO_MIME_TYPES.includes(file.type)) {
      alert("対応していない動画形式です");
      return;
    }

    // 長さチェック
    try {
      const { duration } = await getVideoMetaFromFile(file);
      if (duration > MAX_VIDEO_SEC + 1) {
        alert(`動画は ${MAX_VIDEO_SEC} 秒以内にしてください`);
        return;
      }
    } catch {
      alert("動画情報の取得に失敗しました");
      return;
    }

    setFormMedia((prev) => {
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
    setFormMedia((prev) => {
      if (from === to) return prev;
      if (from < 0 || to < 0 || from >= prev.length || to >= prev.length)
        return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const selectedMediaRows = formMedia.map((m, idx) => ({
    id: m.id,
    type: m.type,
    name: m.file.name,
    index: idx,
  }));

  /* ===== 新規セクション追加 ===== */
  const handleAddSection = useCallback(async () => {
    const baseJa = newTitle.trim();
    if (!baseJa) {
      alert("セクション名を入力してください");
      return;
    }

    if (formMedia.length === 0) {
      alert("画像または動画を1つ以上選択してください");
      return;
    }

    // 画像3・動画1チェック（念のため）
    const imageCount = formMedia.filter((m) => m.type === "image").length;
    const videoCount = formMedia.filter((m) => m.type === "video").length;
    if (imageCount > MAX_IMAGES || videoCount > MAX_VIDEOS) {
      alert("画像は最大3枚・動画は1本までです");
      return;
    }

    try {
      setCreating(true);
      const newOrder = sections.length;

      // 1) ベースドキュメント作成
      const refDoc = await addDoc(collection(db, "menuSections"), {
        title: baseJa,
        order: newOrder,
        siteKey: SITE_KEY,
        mediaType: null,
        mediaUrl: null,
        mediaItems: [],
      });

      // 2) タイトルを全言語へ翻訳して保存
      const i18n = await buildTitleI18n(baseJa);
      const tTitleArr =
        LANGS.map((l) => {
          const title = i18n[l.key as UILang];
          return title
            ? { lang: l.key as UILang, title }
            : { lang: l.key as UILang, title: "" };
        }) ?? [];

      await updateDoc(doc(db, "menuSections", refDoc.id), {
        title: baseJa,
        titleI18n: i18n,
        baseTitle: { title: baseJa },
        tTitle: tTitleArr,
      });

      // 3) メディアを順番通りアップロード
      const uploaded: { url: string; type: MediaType }[] = [];
      setUploadPercent(0);
      setUploadOpen(true);

      for (let index = 0; index < formMedia.length; index++) {
        const item = formMedia[index];
        const f = item.file;
        const type = item.type;

        const ext = getExt(f.name) || (type === "image" ? "jpg" : "mp4");
        const path = `sections/${SITE_KEY}/${refDoc.id}/${index + 1}.${ext}`;
        const sref = storageRef(getStorage(), path);

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
                ((index + pct / 100) / formMedia.length) * 100 || 0;
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

      await updateDoc(doc(db, "menuSections", refDoc.id), {
        mediaType: primary?.type ?? null,
        mediaUrl: primary?.url ?? null,
        mediaItems: uploaded,
      });

      // 4) 後始末
      setNewTitle("");
      setFormMedia([]);
      setShowModal(false);
    } catch (e: any) {
      if (e?.code === "storage/canceled") {
        console.info("upload canceled");
      } else {
        console.error(e);
        alert("セクションの追加に失敗しました。");
      }
    } finally {
      setCreating(false);
      setUploadOpen(false);
      uploadTaskRef.current = null;
    }
  }, [newTitle, formMedia, sections.length]);

  const wrapperClass = `p-4 max-w-2xl mx-auto pt-10 ${
    isLoggedIn ? "pb-20" : ""
  }`;

  return (
    <div className="relative">
      <div className={wrapperClass}>
        {/* 右下：＋セクションを追加 */}
        {isLoggedIn && (
          <button
            type="button"
            onClick={() => setShowModal(true)}
            aria-label="セクションを追加"
            title="セクションを追加"
            className="fixed bottom-6 right-6 z-50
               w-14 h-14 rounded-full bg-blue-600 text-white
               shadow-lg hover:bg-blue-700 active:scale-95
               flex items-center justify-center leading-none p-0"
          >
            +
          </button>
        )}

        <motion.h1
          variants={titleParent}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.3 }}
          className="text-3xl font-semibold text-white text-outline mb-10"
          aria-label={pageTitle}
        >
          {Array.from(pageTitle).map((ch, i) => (
            <motion.span key={i} variants={titleChild} className="inline-block">
              {ch === " " ? "\u00A0" : ch}
            </motion.span>
          ))}
        </motion.h1>

        {/* 並び替えコンテナ */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sections.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-4 sm:gap-6 md:gap-8">
              {sections.map((section) => (
                <SortableSectionItem key={section.id} id={section.id}>
                  {({ attributes, listeners, isDragging }) => (
                    <motion.div
                      className="relative"
                      initial={{ opacity: 0, y: 12 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.3 }}
                      transition={{
                        duration: 0.45,
                        ease: "easeOut",
                        delay: 0.05,
                      }}
                    >
                      {isLoggedIn && (
                        <div
                          {...attributes}
                          {...listeners}
                          className="absolute left-1/2 -translate-x-1/2 -top-4 z-10 cursor-grab active:cursor-grabbing touch-none select-none"
                          aria-label="ドラッグで並び替え"
                          onTouchStart={(e) => e.preventDefault()}
                        >
                          <div className="w-10 h-10 bg-gray-200 text-gray-700 rounded-full text-sm flex items-center justify-center shadow">
                            ☰
                          </div>
                        </div>
                      )}

                      <div className={isDragging ? "opacity-70" : ""}>
                        <MenuSectionCard
                          section={section}
                          isLoggedIn={isLoggedIn}
                          onDeleteSection={() => {
                            setSections((prev) =>
                              prev.filter((s) => s.id !== section.id)
                            );
                          }}
                          onSectionPatch={(patch) => {
                            setSections((prev) =>
                              prev.map((s) =>
                                s.id === section.id ? { ...s, ...patch } : s
                              )
                            );
                          }}
                        />
                      </div>
                    </motion.div>
                  )}
                </SortableSectionItem>
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {/* 追加モーダル（画像3＋動画1・並べ替え可） */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-sm max-h-[90vh] overflow-y-auto">
              <h2 className="text-lg font-bold mb-4">新しいセクションを追加</h2>

              <label className="text-sm font-medium">セクション名</label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="例：ネイル、ヘアカット"
                className="mb-3 mt-1"
                disabled={creating}
              />

              {/* メディア選択 */}
              <div className="space-y-3 mb-4">
                <div className="text-sm font-medium">メディア（任意）</div>

                {/* 画像追加 */}
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-gray-600">画像（最大3枚）</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={pickImages}
                    disabled={creating}
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
                      handleAddImages(e.target.files);
                      if (e.target) e.target.value = "";
                    }}
                  />
                </div>

                {/* 動画追加 */}
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-gray-600">
                    動画（任意・1つまで）
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={pickVideo}
                    disabled={creating}
                  >
                    動画を選択（{MAX_VIDEO_SEC}秒まで）
                  </Button>
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept={VIDEO_MIME_TYPES.join(",")}
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      handleAddVideo(f);
                      if (e.target) e.target.value = "";
                    }}
                  />
                </div>

                {/* 選択済み一覧 ＋ 並べ替え */}
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
                          {row.type === "image" ? "画像" : "動画"}（{row.name}）
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => moveMedia(row.index, row.index - 1)}
                            disabled={creating || row.index === 0}
                            className="text-xs px-1 py-0.5 border rounded bg-white disabled:opacity-40"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => moveMedia(row.index, row.index + 1)}
                            disabled={
                              creating ||
                              row.index === selectedMediaRows.length - 1
                            }
                            className="text-xs px-1 py-0.5 border rounded bg-white disabled:opacity-40"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setFormMedia((prev) =>
                                prev.filter((_, i) => i !== row.index)
                              )
                            }
                            disabled={creating}
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
                  onClick={() => {
                    if (creating) return;
                    setShowModal(false);
                    setNewTitle("");
                    setFormMedia([]);
                  }}
                  disabled={creating}
                >
                  キャンセル
                </Button>
                <Button onClick={handleAddSection} disabled={creating}>
                  {creating ? "追加中…" : "追加"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 進捗モーダル */}
      <UploadProgressModal
        open={uploadOpen}
        percent={uploadPercent}
        onCancel={cancelUpload}
        title="メディアをアップロード中…"
      />

      {isLoggedIn && (
        <>
          {/* ？フローティングボタン */}
          <button
            type="button"
            onClick={() => setShowHelp(true)}
            aria-label="操作ヒントを表示"
            className="fixed top-15 right-5 z-50 w-12 h-12 rounded-full bg-blue-600 text-white text-2xl leading-none flex items-center justify-center shadow-lg hover:bg-blue-700 active:scale-95"
          >
            ?
          </button>

          {/* モーダル */}
          {showHelp && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="bg-white w-[90%] max-w-md rounded-lg shadow-xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-semibold">操作ヒント</h3>
                  <button
                    onClick={() => setShowHelp(false)}
                    aria-label="閉じる"
                    className="ml-3 text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-3 text-sm text-blue-800">
                  <div>
                    <strong>1. 削除</strong> 行を<strong>左にスライド</strong>
                    すると削除ボタンが表示されます。 行を
                    <strong>右にスライド</strong>
                    すると編集ボタンが表示されます。
                  </div>
                  <div>
                    <strong>2. 並び替え</strong>{" "}
                    セクションや項目はドラッグ＆ドロップで順番を変更できます。
                  </div>
                  <div>
                    <strong>3. メディア編集</strong> 「✎
                    セクション名/メディア」ボタンから画像や動画を追加・変更できます。
                  </div>
                  <div>
                    <strong>4. 保存</strong>{" "}
                    編集後は自動保存されます。保存が完了すると緑色の通知が表示されます。
                  </div>
                </div>

                <div className="mt-5 text-right">
                  <button
                    onClick={() => setShowHelp(false)}
                    className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
                  >
                    OK
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

/* =========================
   進捗モーダル
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
        <div className="mt-4 flex justify-end gap-2">
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
