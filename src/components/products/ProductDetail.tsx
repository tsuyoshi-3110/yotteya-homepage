// src/components/products/ProductDetail.tsx
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { v4 as uuid } from "uuid";
import { motion } from "framer-motion";

import { useThemeGradient } from "@/lib/useThemeGradient";
import { type Product } from "@/types/Product";

import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  collection,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import { getStorage, ref, deleteObject } from "firebase/storage";

import CardSpinner from "../CardSpinner";
import { BusyOverlay } from "../BusyOverlay";
import ProductMedia from "../ProductMedia";

/* ファイル形式ユーティリティ */
import { IMAGE_MIME_TYPES, VIDEO_MIME_TYPES } from "@/lib/fileTypes";

/* アップロード共通ロジック（一覧と同じ） */
import { uploadProductMedia } from "@/lib/media/uploadProductMedia";

import { SITE_KEY } from "@/lib/atoms/siteKeyAtom";

/* ▼ 多言語対応：UI言語 & LangKey */
import { type LangKey } from "@/lib/langs";
import { useUILang } from "@/lib/atoms/uiLangAtom";

/* ▼ 為替レート（カード一覧と同様の通貨表示ロジックを適用） */
import { useFxRates } from "@/lib/fx/client";

/* ▼ 価格・通貨ユーティリティ（一覧と共通） */
import {
  formatPriceFromJPY,
  TAX_T,
  TAX_RATE,
  rint,
  toInclYen,
  toExclYen,
} from "./priceUtils";

/* ▼ 商品の多言語フィールド処理（詳細用） */
import {
  ProductDoc,
  normalizePrice,
  pickLocalized,
  translateAll,
} from "./productDetailLocales";

type MediaType = "image" | "video";

/* ▼ セクション（タイトルのみ、多言語対応・order対応） */
type Section = {
  id: string;
  base: { title: string };
  t: Array<{ lang: LangKey; title?: string }>;
  createdAt?: any;
  order?: number;
};

/* 編集用メディアアイテム（既存URL + 新規File を両方扱う） */
type EditableMediaItem = {
  id: string;
  url?: string;
  file?: File;
  type: MediaType;
};

export default function ProductDetail({ product }: { product: Product }) {
  /* ---------- 権限・テーマ ---------- */
  const [isAdmin, setIsAdmin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPercent, setUploadingPercent] = useState<number | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const uploading = progress !== null;

  const gradient = useThemeGradient();
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setIsAdmin(!!u));
    return () => unsub();
  }, []);

  /* ---------- UI言語 ---------- */
  const { uiLang } = useUILang();
  const taxT = TAX_T[uiLang] ?? TAX_T.ja;

  /* ---------- 為替レート ---------- */
  const { rates } = useFxRates();

  /* ---------- 表示用データ ---------- */
  const seedProduct: ProductDoc = {
    ...(product as ProductDoc),
    price: normalizePrice(
      (product as ProductDoc).priceIncl ?? (product as ProductDoc).price
    ),
    priceIncl: (product as ProductDoc).priceIncl,
    priceExcl: (product as ProductDoc).priceExcl,
    taxRate: (product as ProductDoc).taxRate ?? TAX_RATE,
  };

  const [displayProduct, setDisplayProduct] = useState<ProductDoc>(seedProduct);

  /* ---------- セクション一覧（ピッカー用） ---------- */
  const [sections, setSections] = useState<Section[]>([]);

  /* ---------- 編集モーダル用 state ---------- */
  const [showEdit, setShowEdit] = useState(false);
  const [title, setTitle] = useState(product.title);
  const [body, setBody] = useState<string>(product.body ?? "");
  const [price, setPrice] = useState<number | "">(
    normalizePrice((product as ProductDoc).price)
  );
  const [taxIncluded, setTaxIncluded] = useState(true);

  // セクション選択
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(
    (product as any).sectionId ?? null
  );

  // 編集用メディア（画像1〜3＋動画1）
  const [mediaItemsState, setMediaItemsState] = useState<EditableMediaItem[]>(
    []
  );

  const maxImages = 3;
  const maxVideos = 1;

  const imageCount = useMemo(
    () => mediaItemsState.filter((m) => m.type === "image").length,
    [mediaItemsState]
  );
  const videoCount = useMemo(
    () => mediaItemsState.filter((m) => m.type === "video").length,
    [mediaItemsState]
  );
  const canAddImage = imageCount < maxImages;
  const canAddVideo = videoCount < maxVideos;

  // product 変更時の同期（表示用のみ）
  useEffect(() => {
    const pNum = normalizePrice(
      (product as ProductDoc).priceIncl ?? (product as ProductDoc).price
    );

    setDisplayProduct({
      ...(product as ProductDoc),
      price: pNum,
      priceIncl: (product as ProductDoc).priceIncl ?? pNum,
      priceExcl: (product as ProductDoc).priceExcl,
      taxRate: (product as ProductDoc).taxRate ?? TAX_RATE,
    });

    setSelectedSectionId((product as any).sectionId ?? null);
    setBody(product.body ?? "");
    setPrice(pNum);
    setTitle(product.title ?? "");
    setTaxIncluded(true);
  }, [product]);

  /* ---------- セクション購読（createdAt → order 昇順） ---------- */
  useEffect(() => {
    const secRef = collection(db, "siteSections", SITE_KEY, "sections");
    const q = query(secRef, orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const rows: Section[] = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          base: data.base ?? { title: data.title ?? "" },
          t: Array.isArray(data.t) ? data.t : [],
          createdAt: data.createdAt,
          order: typeof data.order === "number" ? data.order : undefined,
        };
      });

      rows.sort((a, b) => {
        const ao = a.order ?? 999999;
        const bo = b.order ?? 999999;
        if (ao !== bo) return ao - bo;
        const at = a.createdAt?.toMillis?.() ?? 0;
        const bt = b.createdAt?.toMillis?.() ?? 0;
        return at - bt;
      });

      setSections(rows);
    });
    return () => unsub();
  }, []);

  /* ---------- 編集モーダルを開くときにメディア一覧をセット ---------- */
  const openEditModal = useCallback(() => {
    const p = normalizePrice(displayProduct.priceIncl ?? displayProduct.price);

    setTitle(displayProduct.base?.title ?? displayProduct.title ?? "");
    setBody(displayProduct.base?.body ?? displayProduct.body ?? "");
    setPrice(p);
    setTaxIncluded(true);
    setSelectedSectionId(displayProduct.sectionId ?? null);
    setProgress(null);

    // Firestore の mediaItems({url,type}[]) → 編集用 state に変換
    const rawMedia = (displayProduct as any).mediaItems as
      | { url: string; type: MediaType }[]
      | undefined;

    let items: EditableMediaItem[] = [];

    if (Array.isArray(rawMedia) && rawMedia.length > 0) {
      items = rawMedia.map((m) => ({
        id: uuid(),
        url: m.url,
        type: (m.type as MediaType) || "image",
      }));
    } else if (displayProduct.mediaURL) {
      items = [
        {
          id: uuid(),
          url: displayProduct.mediaURL,
          type:
            displayProduct.mediaType === "video"
              ? "video"
              : ("image" as MediaType),
        },
      ];
    }

    setMediaItemsState(items);

    setShowEdit(true);
  }, [displayProduct]);

  /* ---------- メディア編集用ハンドラ ---------- */

  const handleRemoveMedia = (idx: number) => {
    setMediaItemsState((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAddImages = (files: FileList | null) => {
    if (!files) return;

    setMediaItemsState((prev) => {
      const currentImageCount = prev.filter((m) => m.type === "image").length;
      const remainingSlots = maxImages - currentImageCount;
      if (remainingSlots <= 0) return prev;

      const arr = Array.from(files);
      const toAdd = arr
        .filter((f) => IMAGE_MIME_TYPES.includes(f.type))
        .slice(0, remainingSlots)
        .map<EditableMediaItem>((f) => ({
          id: uuid(),
          file: f,
          type: "image",
        }));

      if (toAdd.length === 0) return prev;

      // 既に動画がある場合は、その直前に画像を挿入して動画を最後に保つ
      const videoIndex = prev.findIndex((m) => m.type === "video");
      if (videoIndex === -1) {
        return [...prev, ...toAdd];
      } else {
        const head = prev.slice(0, videoIndex);
        const tail = prev.slice(videoIndex);
        return [...head, ...toAdd, ...tail];
      }
    });
  };

  const handleAddVideo = (file: File | null) => {
    if (!file) return;
    if (!VIDEO_MIME_TYPES.includes(file.type)) {
      alert("対応していない動画形式です");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      alert("動画は 50 MB 未満にしてください");
      return;
    }

    setMediaItemsState((prev) => {
      const videoExists = prev.some((m) => m.type === "video");
      if (videoExists) {
        alert("動画は 1 つまでです");
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

  /* ---------- 編集保存 ---------- */
  const handleSave = useCallback(async () => {
    if (!title.trim()) return alert("タイトル必須");
    if (price === "") return alert("価格を入力してください");

    if (mediaItemsState.length === 0) {
      alert("メディアを1つ以上設定してください");
      return;
    }

    setSaving(true); // BusyOverlay

    try {
      // --- メディアアップロード／確定 ---
      const uploadedMedia: { url: string; type: MediaType }[] = [];

      const hasNewFile = mediaItemsState.some((m) => !!m.file);
      if (hasNewFile) {
        setProgress(0);
        setUploadingPercent(0);
      }

      for (let index = 0; index < mediaItemsState.length; index++) {
        const item = mediaItemsState[index];

        // 既存 URL のみ（アップロード不要）
        if (!item.file) {
          if (item.url) {
            uploadedMedia.push({ url: item.url, type: item.type });
          }
          continue;
        }

        const f = item.file;

        const isValidImage = IMAGE_MIME_TYPES.includes(f.type);
        const isValidVideo = VIDEO_MIME_TYPES.includes(f.type);
        const isVideo = item.type === "video" || f.type.startsWith("video/");

        if (!isValidImage && !isValidVideo) {
          alert("対応形式ではありません");
          throw new Error("invalid file type");
        }
        if (isVideo && f.size > 50 * 1024 * 1024) {
          alert("動画は 50 MB 未満にしてください");
          throw new Error("video too large");
        }

        const up = await uploadProductMedia({
          file: f,
          siteKey: SITE_KEY,
          docId: index === 0 ? product.id : `${product.id}_${index + 1}`,
          previousType:
            index === 0 ? (displayProduct.mediaType as any) : undefined,
          onProgress: (pct) => {
            setProgress(pct);
            setUploadingPercent(pct);
          },
        });

        uploadedMedia.push({
          url: up.mediaURL,
          type: up.mediaType as MediaType,
        });
      }

      if (hasNewFile) {
        setProgress(null);
        setUploadingPercent(null);
      }

      // 代表メディア
      const primary = uploadedMedia[0];
      const mediaURL = primary?.url ?? "";
      const mediaType: MediaType = primary?.type ?? "image";

      // --- 多言語フィールド ---
      const base = { title: title.trim(), body: (body ?? "").trim() };
      const t = await translateAll(base.title, base.body);

      // --- 税込/税抜の両方を算出 ---
      const input = Number(price);
      const priceIncl = taxIncluded ? rint(input) : toInclYen(input);
      const priceExcl = taxIncluded ? toExclYen(priceIncl) : rint(input);

      // 代表ファイル名（新規ファイルがあればその最初のもの、なければ既存）
      const firstNewFile = mediaItemsState.find((m) => !!m.file)?.file ?? null;
      const originalFileName =
        firstNewFile?.name ?? (displayProduct as any).originalFileName;

      // --- Firestore 更新 ---
      await updateDoc(doc(db, "siteProducts", SITE_KEY, "items", product.id), {
        title: base.title,
        body: base.body,
        price: priceIncl,
        priceIncl,
        priceExcl,
        taxRate: TAX_RATE,
        priceInputMode: taxIncluded ? "incl" : "excl",
        taxIncluded: true,
        mediaURL,
        mediaType,
        mediaItems: uploadedMedia,
        base,
        t,
        sectionId: selectedSectionId ?? null,
        originalFileName: originalFileName,
        updatedAt: serverTimestamp(),
      });

      // --- ローカル即時反映 ---
      setDisplayProduct((prev) => ({
        ...(prev as ProductDoc),
        title: base.title,
        body: base.body,
        price: priceIncl,
        priceIncl,
        priceExcl,
        taxRate: TAX_RATE,
        mediaURL,
        mediaType,
        mediaItems: uploadedMedia,
        base,
        t,
        sectionId: selectedSectionId ?? null,
        originalFileName,
      }));

      setShowEdit(false);
    } catch (err) {
      console.error(err);
      alert("保存に失敗しました");
      setProgress(null);
      setUploadingPercent(null);
    } finally {
      setSaving(false);
    }
  }, [
    title,
    body,
    price,
    taxIncluded,
    mediaItemsState,
    selectedSectionId,
    product.id,
    displayProduct,
  ]);

  // 削除
  const handleDelete = async () => {
    if (!confirm(`「${displayProduct.title}」を削除しますか？`)) return;

    const storage = getStorage();

    try {
      // 複数メディアがあればすべて削除を試みる
      const rawMedia = (displayProduct as any).mediaItems as
        | { url: string; type: MediaType }[]
        | undefined;

      const urls = new Set<string>();

      if (Array.isArray(rawMedia)) {
        rawMedia.forEach((m) => {
          if (m.url) urls.add(m.url);
        });
      }

      if (displayProduct.mediaURL) {
        urls.add(displayProduct.mediaURL);
      }

      for (const url of urls) {
        try {
          const fileRef = ref(storage, url);
          await deleteObject(fileRef);
        } catch (err: any) {
          if (err?.code === "storage/object-not-found") {
            console.warn("Storage: 既に削除済みの可能性があります");
          } else {
            console.warn("Storage削除エラー（続行します）:", err);
          }
        }
      }

      await deleteDoc(doc(db, "siteProducts", SITE_KEY, "items", product.id));
      router.back();
    } catch (e) {
      console.error(e);
      alert("削除に失敗しました");
    }
  };

  const moveMedia = (from: number, to: number) => {
    setMediaItemsState((prev) => {
      const total = prev.length;
      if (from === to) return prev;
      if (from < 0 || to < 0 || from >= total || to >= total) return prev;

      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  if (!displayProduct) {
    return (
      <main className="min-h-screen flex items-center justify-center pt-24">
        <CardSpinner />
      </main>
    );
  }

  /* 表示テキスト（タイトル/本文のみ多言語） */
  const loc = pickLocalized(displayProduct, uiLang);

  /* 表示価格：UI言語の通貨に変換（レートが無ければ JPY のまま） */
  const amountJPY = Number(
    displayProduct.price ?? displayProduct.priceIncl ?? 0
  );
  const { text: priceText, approx } = formatPriceFromJPY(
    amountJPY,
    uiLang,
    rates
  );

  // 表示用メディア（スライド）
  const baseMediaType: MediaType =
    displayProduct.mediaType === "video" ? "video" : "image";
  const baseMediaSrc = displayProduct.mediaURL;

  const rawDisplayMedia = (displayProduct as any).mediaItems as
    | { url: string; type: MediaType }[]
    | undefined;

  const slides: { src: string; type: MediaType }[] =
    Array.isArray(rawDisplayMedia) && rawDisplayMedia.length > 0
      ? rawDisplayMedia.map((m) => ({
          src: m.url,
          type: (m.type as MediaType) || "image",
        }))
      : baseMediaSrc
      ? [
          {
            src: baseMediaSrc,
            type: baseMediaType,
          },
        ]
      : [];

  const primarySrc = slides[0]?.src ?? baseMediaSrc;
  const primaryType = slides[0]?.type ?? baseMediaType;

  return (
    <main className="min-h-screen flex items-start justify-center p-4 pt-24">
      {/* アップロード/保存中オーバーレイ */}
      <BusyOverlay uploadingPercent={uploadingPercent} saving={saving} />

      {/* カード外枠 */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.3 }}
        className={clsx(
          "border rounded-lg overflow-hidden shadow relative transition-colors duration-200",
          "w-full max-w-md",
          "bg-gradient-to-b",
          "mt-5",
          gradient,
          "text-black"
        )}
      >
        {/* 編集・削除 */}
        {isAdmin && (
          <div className="absolute top-2 right-2 z-20 flex gap-1">
            <button
              onClick={openEditModal}
              className="px-2 py-1 bg-blue-600 text-white text-md rounded shadow disabled:opacity-50"
            >
              編集
            </button>
            <button
              onClick={handleDelete}
              className="px-2 py-1 bg-red-600 text-white text-md rounded shadow disabled:opacity-50"
            >
              削除
            </button>
          </div>
        )}

        {/* メディア（スライド対応：複数あれば自動スライド） */}
        {primarySrc && (
          <ProductMedia
            src={primarySrc}
            type={primaryType}
            items={slides.length > 0 ? slides : undefined}
            alt={loc.title || displayProduct.title}
          />
        )}

        {/* テキスト */}
        <div className="p-4 space-y-2">
          <h1 className={clsx("text-lg font-bold", "text-black")}>
            {loc.title}
          </h1>
          <p className={clsx("font-semibold", "text-black")}>
            {approx ? "≈ " : ""}
            {priceText}（{taxT.incl}）
          </p>
          {loc.body && (
            <p
              className={clsx(
                "text-sm whitespace-pre-wrap leading-relaxed",
                "text-black"
              )}
            >
              {loc.body}
            </p>
          )}
        </div>
      </motion.div>

      {/* ---------- 編集モーダル ---------- */}
      {isAdmin && showEdit && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 overflow-y-auto">
          <div className="w-full max-w-md bg-white rounded-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-center">商品を編集</h2>

            {/* セクションピッカー */}
            <div className="space-y-1">
              <label className="text-sm">カテゴリー</label>
              <select
                className="w-full border px-3 h-10 rounded bg-white"
                value={selectedSectionId ?? ""}
                onChange={(e) =>
                  setSelectedSectionId(
                    e.target.value === "" ? null : e.target.value
                  )
                }
                disabled={uploading}
              >
                <option value="">未設定</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.base?.title ?? ""}
                  </option>
                ))}
              </select>
            </div>

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
                  disabled={uploading}
                />
                税込
              </label>
              <label>
                <input
                  type="radio"
                  checked={!taxIncluded}
                  onChange={() => setTaxIncluded(false)}
                  disabled={uploading}
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

            {/* メディア一覧・追加・削除 */}
            <div className="space-y-2">
              <label className="text-sm">
                メディア（画像 最大3枚・動画 最大1つ）
              </label>

              {mediaItemsState.length === 0 && (
                <p className="text-xs text-gray-500">メディアは未設定です。</p>
              )}

              {mediaItemsState.map((m, idx) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded border px-3 py-2 text-sm bg-gray-50"
                >
                  <span className="truncate">
                    {idx + 1}. {m.type === "image" ? "画像" : "動画"}{" "}
                    {m.file ? `(新規: ${m.file.name})` : "(既存)"}
                  </span>

                  <div className="flex items-center gap-1">
                    {/* 並べ替えボタン */}
                    <button
                      type="button"
                      onClick={() => moveMedia(idx, idx - 1)}
                      disabled={uploading || idx === 0}
                      className="text-xs px-1 py-0.5 border rounded bg-white disabled:opacity-40"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveMedia(idx, idx + 1)}
                      disabled={uploading || idx === mediaItemsState.length - 1}
                      className="text-xs px-1 py-0.5 border rounded bg-white disabled:opacity-40"
                    >
                      ↓
                    </button>

                    {/* 削除ボタン */}
                    <button
                      type="button"
                      onClick={() => handleRemoveMedia(idx)}
                      className="text-red-600 text-xs underline disabled:opacity-40"
                      disabled={uploading}
                    >
                      削除
                    </button>
                  </div>
                </div>
              ))}

              {/* 画像追加 */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-700">
                  画像を追加（残り {Math.max(0, maxImages - imageCount)} 枚）
                </label>
                <input
                  type="file"
                  accept={IMAGE_MIME_TYPES.join(",")}
                  multiple
                  onChange={(e) => {
                    handleAddImages(e.target.files);
                    if (e.target) e.target.value = "";
                  }}
                  className="bg-gray-500 text-white w-full h-10 px-3 py-1 rounded disabled:opacity-50"
                  disabled={uploading || !canAddImage}
                />
              </div>

              {/* 動画追加 */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-700">
                  動画を追加（最大1つ）
                </label>
                <input
                  type="file"
                  accept={VIDEO_MIME_TYPES.join(",")}
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    if (f) {
                      handleAddVideo(f);
                    }
                    if (e.target) e.target.value = "";
                  }}
                  className="bg-gray-500 text-white w-full h-10 px-3 py-1 rounded disabled:opacity-50"
                  disabled={uploading || !canAddVideo}
                />
              </div>
            </div>

            {/* アップロード進捗 */}
            {uploading && (
              <div className="w-full flex flex-col items-center gap-2">
                <p>アップロード中… {progress ?? 0}%</p>
                <div className="w-full h-2 bg-gray-200 rounded">
                  <div
                    className="h-full bg-green-500 rounded transition-all"
                    style={{ width: `${progress ?? 0}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-center">
              <button
                onClick={handleSave}
                disabled={uploading}
                className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
              >
                更新
              </button>
              <button
                onClick={() => !uploading && setShowEdit(false)}
                disabled={uploading}
                className="px-4 py-2 bg-gray-500 text-white rounded disabled:opacity-50"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
