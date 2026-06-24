"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Pin, Plus } from "lucide-react";
import { v4 as uuid } from "uuid";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  serverTimestamp,
  CollectionReference,
  DocumentData,
  getDoc,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useThemeGradient } from "@/lib/useThemeGradient";
import clsx from "clsx";
import { motion, type Variants, type Transition } from "framer-motion";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import SortableItem from "../SortableItem";
import { useRouter } from "next/navigation";

import ProductMedia from "../ProductMedia";
import { uploadProductMedia } from "@/lib/media/uploadProductMedia";
import { useSiteKey } from "@/lib/atoms/siteKeyAtom";

// 多言語
import { useUILang } from "@/lib/atoms/uiLangAtom";
import { BusyOverlay } from "../BusyOverlay";
import { IMAGE_MIME_TYPES, VIDEO_MIME_TYPES } from "@/lib/fileTypes";
import { displayOf, sectionTitleLoc } from "@/lib/i18n/display";
import { translateAll, translateSectionTitleAll } from "@/lib/i18n/translate";
import {
  type ProdDoc,
  type Base,
  type Tr,
  type MediaType,
} from "@/types/productLocales";
import { useProducts } from "@/hooks/useProducts";
import { useSections } from "@/hooks/useSections";
import SectionManagerModal from "./SectionManagerModal";
import { useFxRates } from "@/lib/fx/client";

// 分割したモジュール
import { PAGE_SIZE, MAX_VIDEO_SEC } from "./config";
import { PAGE_TITLE_T, ALL_CATEGORY_T } from "./productsTexts";
import {
  TAX_T,
  toExclYen,
  toInclYen,
  rint,
  formatPriceFromJPY,
} from "./priceUtils";
import KeywordModal from "./KeywordModal";

/* ===== フォーム用メディア型 ===== */
type FormMediaItem = {
  id: string;
  type: MediaType; // "image" | "video"
  file: File;
};

type SelectedRow = {
  id: string;
  type: MediaType;
  file: File;
  index: number;
};

const STAGGER_EASE: Transition["ease"] = [0.16, 1, 0.3, 1];

function StaggerChars({
  text,
  className,
  delay = 0.15,
  stagger = 0.045,
  duration = 0.9,
}: {
  text: string;
  className?: string;
  delay?: number;
  stagger?: number;
  duration?: number;
}) {
  const container: Variants = {
    hidden: { opacity: 1 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: stagger,
        delayChildren: delay,
      },
    },
  };

  const child: Variants = {
    hidden: { opacity: 0, y: 6 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration, ease: STAGGER_EASE },
    },
  };

  return (
    <motion.span
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.7 }} // 画面にしっかり入ってから発火
      className={className}
    >
      {Array.from(text).map((ch, i) => (
        <motion.span key={i} variants={child} className="inline-block">
          {ch === " " ? "\u00A0" : ch}
        </motion.span>
      ))}
    </motion.span>
  );
}

/* ======================= 本体 ======================= */

export default function ProductsClient() {
  const siteKey = useSiteKey();
  /* ===== 状態 ===== */
  const [isAdmin, setIsAdmin] = useState(false);
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editing, setEditing] = useState<ProdDoc | null>(null);

  // メディア（画像1〜3枚＋動画1つ）: 並び順もこの配列の順を採用
  const [formMedia, setFormMedia] = useState<FormMediaItem[]>([]);

  // Firestore から補完用: id -> mediaItems
  const [mediaItemsMap, setMediaItemsMap] = useState<
    Record<string, { url: string; type: MediaType }[]>
  >({});

  // 原文（日本語）
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [price, setPrice] = useState<number | "">("");
  const [taxIncluded, setTaxIncluded] = useState(true); // デフォルト税込

  // セクション（フォーム用）
  const [formSectionId, setFormSectionId] = useState<string>("");
  const [selectedSectionId, setSelectedSectionId] = useState<string>("all");
  const [showSecModal, setShowSecModal] = useState(false);
  const [newSecName, setNewSecName] = useState("");

  // 進捗
  const [progress, setProgress] = useState<number | null>(null);
  const [uploadingPercent, setUploadingPercent] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const uploading = progress !== null;

  // AI 生成
  const [aiLoading, setAiLoading] = useState(false);
  const [showKeywordModal, setShowKeywordModal] = useState(false);

  const gradient = useThemeGradient();
  const router = useRouter();
  const { uiLang } = useUILang();
  const taxT = TAX_T[uiLang] ?? TAX_T.ja;

  /* 為替 */
  const { rates } = useFxRates();
  const pageTitle = PAGE_TITLE_T[uiLang] ?? PAGE_TITLE_T.ja;

  /* ===== Firestore refs ===== */
  const productColRef: CollectionReference<DocumentData> = useMemo(
    () => collection(db, "siteProducts", siteKey, "items"),
    []
  );

  /* ===== Hooks: Products / Sections ===== */
  const { list, handleDragEnd } = useProducts({
    productColRef,
    selectedSectionId,
    pageSize: PAGE_SIZE,
  });

  const {
    sections,
    add: addSection,
    remove: removeSection,
    reorder: reorderSections,
  } = useSections(siteKey);

  /* ===== 権限 ===== */
  useEffect(() => onAuthStateChanged(auth, (u) => setIsAdmin(!!u)), []);

  /* ===== mediaItems を補完 ===== */
  useEffect(() => {
    const missingIds = list
      .filter((p) => !(p as any).mediaItems && !mediaItemsMap[p.id])
      .map((p) => p.id);

    if (missingIds.length === 0) return;

    missingIds.forEach(async (id) => {
      try {
        const snap = await getDoc(doc(productColRef, id));
        if (!snap.exists()) return;
        const data = snap.data() as any;
        if (Array.isArray(data.mediaItems) && data.mediaItems.length > 0) {
          setMediaItemsMap((prev) => ({
            ...prev,
            [id]: data.mediaItems,
          }));
        }
      } catch (e) {
        console.error("failed to fetch mediaItems for", id, e);
      }
    });
  }, [list, productColRef, mediaItemsMap]);

  /* ===== ラベル ===== */
  const currentSectionLabel =
    selectedSectionId === "all"
      ? ALL_CATEGORY_T[uiLang] ?? ALL_CATEGORY_T.ja
      : sections.find((s) => s.id === selectedSectionId)
      ? sectionTitleLoc(
          sections.find((s) => s.id === selectedSectionId)!,
          uiLang
        )
      : "";

  /* ===== DnD センサー（固定） ===== */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 120, tolerance: 8 },
    })
  );

  /* ===== UIヘルパ ===== */
  const resetFields = useCallback(() => {
    setEditing(null);
    setTitle("");
    setBody("");
    setPrice("");
    setFormMedia([]);
    setFormSectionId("");
    setTaxIncluded(true); // 新規の既定は税込
  }, []);

  const openAdd = useCallback(() => {
    if (uploading) return;
    resetFields();
    setFormMode("add");
  }, [resetFields, uploading]);

  const closeForm = useCallback(() => {
    if (uploading) return;
    setTimeout(() => {
      resetFields();
      setFormMode(null);
    }, 100);
  }, [resetFields, uploading]);

  /* ===== AI 紹介文生成（キーワード対応） ===== */
  const handleGenerateBody = useCallback(
    async (keywords: string[]) => {
      if (!title) {
        alert("タイトルを入力してください");
        return;
      }
      const kws = (keywords || []).map((s) => s.trim()).filter(Boolean);
      if (kws.length === 0) {
        alert("キーワードを1つ以上入力してください");
        return;
      }
      try {
        setAiLoading(true);
        const res = await fetch("/api/generate-description", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, price, keywords: kws }),
        });
        const data = await res.json();
        if (data?.body) {
          setBody(data.body);
        } else {
          alert("生成に失敗しました");
        }
      } catch {
        alert("エラーが発生しました");
      } finally {
        setAiLoading(false);
      }
    },
    [title, price]
  );

  /* ===== 保存 ===== */
  const saveProduct = useCallback(async () => {
    if (uploading) return;
    if (!title.trim()) return alert("タイトル必須");
    if (price === "") return alert("価格を入力してください");

    const hasNewMedia = formMedia.length > 0;

    const existingItems = (editing as any)?.mediaItems as
      | { url: string; type: MediaType }[]
      | undefined;
    const hasExistingMedia =
      !!editing?.mediaURL ||
      (Array.isArray(existingItems) && existingItems.length > 0);

    if (formMode === "add" && !hasNewMedia && !hasExistingMedia) {
      alert("メディアを選択してください");
      return;
    }

    // 画像3枚・動画1本だけのはずだが、念のためチェック
    const imageCount = formMedia.filter((m) => m.type === "image").length;
    const videoCount = formMedia.filter((m) => m.type === "video").length;
    if (imageCount > 3 || videoCount > 1) {
      alert("画像は最大3枚・動画は1本までです");
      return;
    }

    setSaving(true);
    try {
      const id = editing?.id ?? uuid();

      // 既存メディアをベースに
      let mediaURL = editing?.mediaURL ?? "";
      let mediaType: MediaType = (editing?.mediaType ?? "image") as MediaType;
      let mediaItems: { url: string; type: MediaType }[] = [];

      if (Array.isArray(existingItems) && existingItems.length > 0) {
        mediaItems = existingItems.slice();
      } else if (editing?.mediaURL) {
        mediaItems = [{ url: editing.mediaURL, type: mediaType }];
      }

      // 新しいファイルを選択している場合は、フォームの並び順でアップロード
      if (hasNewMedia) {
        mediaItems = [];

        const candidates = formMedia.map((m) => ({
          file: m.file,
          type: m.type,
        }));

        setProgress(0);
        setUploadingPercent(0);

        for (let index = 0; index < candidates.length; index++) {
          const { file: f } = candidates[index];

          const isValidImage = IMAGE_MIME_TYPES.includes(f.type);
          const isValidVideo = VIDEO_MIME_TYPES.includes(f.type);
          if (!isValidImage && !isValidVideo) {
            alert(
              "対応形式：画像（JPEG, PNG, WEBP, GIF）／動画（MP4, MOV など）"
            );
            throw new Error("invalid file type");
          }

          const up = await uploadProductMedia({
            file: f,
            siteKey: siteKey,
            docId: index === 0 ? id : `${id}_${index + 1}`,
            previousType: index === 0 ? editing?.mediaType : undefined,
            onProgress: (pct) => {
              setProgress(pct);
              setUploadingPercent(pct);
            },
          });

          mediaItems.push({
            url: up.mediaURL,
            type: up.mediaType as MediaType,
          });

          // 1枚目は従来の mediaURL / mediaType にも反映（互換）
          if (index === 0) {
            mediaURL = up.mediaURL;
            mediaType = up.mediaType as MediaType;
          }
        }

        setProgress(null);
        setUploadingPercent(null);
      }

      // 本文（日本語=base、jaは翻訳しない）
      const base: Base = { title: title.trim(), body: body.trim() };
      const tAll = await translateAll(base.title, base.body);
      const t: Tr[] = tAll.filter((x) => x.lang !== "ja");

      // 価格：入力モードに応じて計算（保存はスクショ準拠フィールドのみ）
      const raw = rint(Number(price) || 0);

      let priceIncl: number;
      let priceExcl: number;
      let priceInputMode: "incl" | "excl";

      if (taxIncluded) {
        priceIncl = raw; // 入力が税込
        priceExcl = toExclYen(raw); // 税抜へ換算
        priceInputMode = "incl";
      } else {
        priceExcl = raw; // 入力が税抜
        priceIncl = toInclYen(raw); // 税込へ換算（例：700 → 770）
        priceInputMode = "excl";
      }

      // Firestore payload（添付スクショの構造 + mediaItems）
      const payload: any = {
        title: base.title,
        body: base.body,
        price: priceIncl, // 表示基準は常に税込
        priceIncl,
        priceExcl,
        priceInputMode, // "incl" | "excl"
        mediaURL,
        mediaType,
        mediaItems,
        base,
        t,
      };

      // 代表ファイル名（1枚目のメディア、なければ既存）
      const primaryFile = formMedia[0]?.file ?? null;
      const originalFileName = primaryFile?.name || editing?.originalFileName;
      if (originalFileName) payload.originalFileName = originalFileName;
      if (formMode === "add") payload.sectionId = formSectionId || null;

      if (formMode === "edit" && editing) {
        await updateDoc(doc(productColRef, id), payload);
      } else {
        await addDoc(productColRef, {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }

      setProgress(null);
      setUploadingPercent(null);
      closeForm();
    } catch (e) {
      console.error(e);
      alert("保存に失敗しました。対応形式や容量をご確認ください。");
      setProgress(null);
      setUploadingPercent(null);
    } finally {
      setSaving(false);
    }
  }, [
    uploading,
    title,
    body,
    price,
    taxIncluded,
    formMode,
    formMedia,
    editing,
    formSectionId,
    productColRef,
    closeForm,
  ]);

  /* ===== 選択中メディア一覧（画像＋動画、どちらも並べ替え可能） ===== */
  const selectedMediaRows: SelectedRow[] = formMedia.map((m, idx) => ({
    id: m.id,
    type: m.type,
    file: m.file,
    index: idx,
  }));

  const moveRow = (from: number, to: number) => {
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

  if (!gradient) return null;

  return (
    <main className="max-w-5xl mx-auto p-4 pt-10">
      <BusyOverlay uploadingPercent={uploadingPercent} saving={saving} />
      <h1
        className="text-3xl font-semibold text-white text-outline"
        aria-label={pageTitle}
      >
        <StaggerChars
          text={pageTitle}
          className="inline-block"
          delay={0.25} // 少し待ってから
          stagger={0.08} // 1文字ずつゆっくり
          duration={1.0} // フワッと
        />
      </h1>

      {/* ヘッダー */}
      <motion.div
        className="mb-10 mt-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3"
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.9 }} // ほぼ全部見えたら発火
        transition={{ duration: 1.6, ease: STAGGER_EASE }} // ゆっくりフワッと
      >
        {/* セクションピッカー */}
        <div className="flex items-center gap-2 ">
          <label className="text-sm text-black opacity-70">
            表示カテゴリ:
          </label>
          <div className="relative inline-block">
            <select
              className={clsx(
                "border rounded px-3 py-2 pr-8",
                "text-transparent caret-transparent selection:bg-transparent",
                "appearance-none"
              )}
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
            >
              <option value="all">
                {ALL_CATEGORY_T[uiLang] ?? ALL_CATEGORY_T.ja}
              </option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {sectionTitleLoc(s, uiLang)}
                </option>
              ))}
            </select>
            <span
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-black"
            >
              {currentSectionLabel}
            </span>
          </div>
        </div>

        {isAdmin && (
          <button
            onClick={() => setShowSecModal(true)}
            className="px-3 py-2 rounded bg-blue-600 text-white shadow hover:bg-blue-700"
          >
            セクション管理
          </button>
        )}
      </motion.div>

      {/* セクション管理モーダル */}
      {showSecModal && (
        <SectionManagerModal
          open={showSecModal}
          onClose={() => setShowSecModal(false)}
          sections={sections}
          saving={saving}
          newSecName={newSecName}
          setNewSecName={setNewSecName}
          onAddSection={async (titleJa) => {
            const t = await translateSectionTitleAll(titleJa);
            await addSection(titleJa, t);
          }}
          onRemoveSection={removeSection}
          onReorderSection={reorderSections}
        />
      )}

      {/* 商品一覧（DnD） */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToWindowEdges]}
      >
        <SortableContext
          items={list.map((p) => p.id)}
          strategy={rectSortingStrategy}
        >
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
            {list.length === 0 && (
              <div className="mt-16 flex items-center justify-center">
                <div className="rounded-2xl border bg-white/30 backdrop-blur px-6 py-8 text-center shadow">
                  <p className="text-black">準備中...</p>
                  {isAdmin && (
                    <p className="text-gray-400 text-sm mt-1">
                      右下の「＋」から新規追加できます
                    </p>
                  )}
                </div>
              </div>
            )}
            {list.map((p) => {
              const loc = displayOf(p, uiLang);
              const amountJPY = p.priceIncl ?? p.price ?? 0;
              const { text, approx } = formatPriceFromJPY(
                amountJPY,
                uiLang,
                rates
              );

              // Firestore から複数メディア（mediaItems）を取り出し
              const rawItems =
                ((p as any).mediaItems as
                  | { url: string; type: MediaType }[]
                  | undefined) ?? mediaItemsMap[p.id];

              const slides: { src: string; type: MediaType }[] =
                Array.isArray(rawItems) && rawItems.length > 0
                  ? rawItems.map((m) => ({
                      src: m.url,
                      type: m.type as MediaType,
                    }))
                  : [
                      {
                        src: p.mediaURL,
                        type: p.mediaType as MediaType,
                      },
                    ];

              const primary = slides[0];

              return (
                <SortableItem key={p.id} product={p}>
                  {({ listeners, attributes, isDragging }) => (
                    <motion.div
                      initial={{ opacity: 0, y: 24, scale: 0.96 }}
                      whileInView={{ opacity: 1, y: 0, scale: 1 }}
                      viewport={{ once: true, amount: 0.65 }}
                      exit={{ opacity: 0, y: 24, scale: 0.96 }}
                      transition={{
                        duration: 1.4, // ← ゆっくりフワッと
                        ease: [0.16, 1, 0.3, 1], // ← なめらかカーブ
                      }}
                      onClick={() => {
                        if (isDragging) return;
                        router.push(`/products/${p.id}`);
                      }}
                      className={clsx(
                        "flex flex-col h-full border shadow relative transition-colors duration-200 rounded-2xl",
                        "bg-linear-to-b",
                        gradient,
                        isDragging ? "bg-yellow-100" : "card-bg",
                        "backdrop-blur-sm",
                        "ring-1 ring-white/10"
                      )}
                    >
                      {auth.currentUser !== null && (
                        <div
                          {...attributes}
                          {...listeners}
                          onClick={(e) => e.stopPropagation()}
                          onContextMenu={(e) => e.preventDefault()}
                          draggable={false}
                          className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 z-30 cursor-grab active:cursor-grabbing select-none p-3"
                          role="button"
                          aria-label="並び替え"
                          style={{ touchAction: "none" }}
                        >
                          <div className="w-10 h-10 rounded-full bg-white/95 flex items-center justify-center shadow pointer-events-none">
                            <Pin className="text-black" />
                          </div>
                        </div>
                      )}

                      {/* スライド表示用：先頭を src/type に渡しつつ、items に全スライド */}
                      <ProductMedia
                        src={primary.src}
                        type={primary.type}
                        items={slides}
                        className="rounded-t-xl"
                        videoDisplay="play"
                      />

                      <div className="p-1 space-y-1">
                        <h2 className="text-black">
                          <StaggerChars
                            text={loc.title || p.title || "（無題）"}
                          />
                        </h2>
                        <p className="text-black">
                          {approx ? "≈ " : ""}
                          {text}（{taxT.incl}）
                        </p>
                      </div>
                    </motion.div>
                  )}
                </SortableItem>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {/* 新規商品追加ボタン */}
      {isAdmin && formMode === null && (
        <button
          onClick={openAdd}
          aria-label="新規追加"
          disabled={uploading}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-lg hover:bg-pink-700 active:scale-95 transition disabled:opacity-50 cursor-pointer"
        >
          <Plus size={28} />
        </button>
      )}

      {/* 新規/編集モーダル（中央表示） */}
      {isAdmin && formMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md bg-white rounded-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-center">
              {formMode === "edit" ? "商品を編集" : "新規商品追加"}
            </h2>

            {formMode === "add" && (
              <div className="flex flex-col gap-1">
                <label className="text-sm">セクション（カテゴリー）</label>
                <select
                  value={formSectionId}
                  onChange={(e) => setFormSectionId(e.target.value)}
                  className="w-full border px-3 h-10 rounded bg-white"
                >
                  <option value="">未設定</option>
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.base?.title ?? ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <input
              type="text"
              placeholder="商品名"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border px-3 py-2 rounded"
              disabled={uploading}
            />

            <input
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="価格 (円)"
              value={price}
              onChange={(e) =>
                setPrice(e.target.value === "" ? "" : Number(e.target.value))
              }
              className="w-full border px-3 py-2 rounded"
              disabled={uploading}
            />

            <div className="flex gap-4">
              <label>
                <input
                  type="radio"
                  checked={taxIncluded}
                  onChange={() => setTaxIncluded(true)}
                />
                税込
              </label>
              <label>
                <input
                  type="radio"
                  checked={!taxIncluded}
                  onChange={() => setTaxIncluded(false)}
                />
                税抜
              </label>
            </div>

            <textarea
              placeholder="紹介文"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full border px-3 py-2 rounded"
              rows={4}
              disabled={uploading}
            />

            {/* AI 紹介文生成（キーワード入力モーダル起動） */}
            <button
              onClick={() => setShowKeywordModal(true)}
              disabled={uploading || aiLoading}
              className="w-full mt-2 px-4 py-2 bg-purple-600 text-white rounded disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {aiLoading ? "生成中…" : "AIで紹介文を生成（キーワード指定）"}
            </button>

            {/* 画像（最大3枚） */}
            <div className="space-y-1 mt-2">
              <label className="text-sm">画像（最大3枚）</label>
              <input
                type="file"
                accept={IMAGE_MIME_TYPES.join(",")}
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []).filter((f) =>
                    IMAGE_MIME_TYPES.includes(f.type)
                  );
                  if (!files.length) {
                    e.target.value = "";
                    return;
                  }
                  setFormMedia((prev) => {
                    const currentImages = prev.filter(
                      (m) => m.type === "image"
                    );
                    const remain = 3 - currentImages.length;
                    if (remain <= 0) {
                      alert("画像は最大3枚までです");
                      return prev;
                    }
                    const toAdd = files.slice(0, remain).map((file) => ({
                      id: uuid(),
                      type: "image" as MediaType,
                      file,
                    }));
                    return [...prev, ...toAdd];
                  });
                  e.target.value = "";
                }}
                className="bg-gray-500 text-white w-full h-10 px-3 py-1 rounded"
                disabled={uploading}
              />
            </div>

            {/* 動画（任意・1つまで） */}
            <div className="space-y-1">
              <label className="text-sm">動画（任意・1つまで）</label>
              <input
                type="file"
                accept={VIDEO_MIME_TYPES.join(",")}
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  if (!f) {
                    e.target.value = "";
                    return;
                  }
                  if (!VIDEO_MIME_TYPES.includes(f.type)) {
                    alert("対応形式ではありません");
                    e.target.value = "";
                    return;
                  }
                  const blobURL = URL.createObjectURL(f);
                  const vid = document.createElement("video");
                  vid.preload = "metadata";
                  vid.src = blobURL;
                  vid.onloadedmetadata = () => {
                    URL.revokeObjectURL(blobURL);
                    if (vid.duration > MAX_VIDEO_SEC) {
                      alert(`動画は ${MAX_VIDEO_SEC} 秒以内にしてください`);
                      (e.target as HTMLInputElement).value = "";
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
                          type: "video" as MediaType,
                          file: f,
                        },
                      ];
                    });
                    (e.target as HTMLInputElement).value = "";
                  };
                }}
                className="bg-gray-500 text-white w-full h-10 px-3 py-1 rounded"
                disabled={uploading}
              />
            </div>

            {/* ▼ 選択中メディア一覧（画像・動画とも ↑↓ で並べ替え） */}
            {selectedMediaRows.length > 0 && (
              <div className="mt-3 space-y-1">
                <p className="text-sm font-semibold">選択中のメディア</p>
                {selectedMediaRows.map((row) => (
                  <div
                    key={row.id}
                    className="flex items-center justify-between rounded border px-3 py-2 text-sm bg-gray-50"
                  >
                    <span className="truncate">
                      {row.index + 1}. {row.type === "image" ? "画像" : "動画"}
                      （{row.file.name}）
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
                        disabled={
                          uploading ||
                          row.index === selectedMediaRows.length - 1
                        }
                        className="text-xs px-1 py-0.5 border rounded bg白 disabled:opacity-40"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFormMedia((prev) =>
                            prev.filter((_, i) => i !== row.index)
                          );
                        }}
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

            {formMode === "edit" && editing?.originalFileName && (
              <p className="text-sm text-gray-600">
                現在のファイル: {editing.originalFileName}
              </p>
            )}

            <div className="flex gap-2 justify-center">
              <button
                onClick={saveProduct}
                disabled={uploading}
                className="px-4 py-2 bg-green-600 text白 rounded disabled:opacity-50"
              >
                {formMode === "edit" ? "更新" : "追加"}
              </button>
              <button
                onClick={closeForm}
                disabled={uploading}
                className="px-4 py-2 bg-gray-500 text白 rounded disabled:opacity-50"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* キーワード入力モーダル */}
      <KeywordModal
        open={showKeywordModal}
        onClose={() => setShowKeywordModal(false)}
        onSubmit={(kws) => {
          setShowKeywordModal(false);
          handleGenerateBody(kws);
        }}
      />
    </main>
  );
}
