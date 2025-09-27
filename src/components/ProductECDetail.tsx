"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import clsx from "clsx";
import { v4 as uuid } from "uuid";
import imageCompression from "browser-image-compression";
import { motion } from "framer-motion";

import { useThemeGradient } from "@/lib/useThemeGradient";
import { ThemeKey, THEMES } from "@/lib/themes";
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
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { SITE_KEY } from "@/lib/atoms/siteKeyAtom";

import CardSpinner from "./CardSpinner";
import { BusyOverlay } from "./BusyOverlay";

import {
  IMAGE_MIME_TYPES,
  VIDEO_MIME_TYPES,
  extFromMime,
} from "@/lib/fileTypes";

// ▼ カート
import { useCart } from "@/lib/cart/CartContext";

/* あなたの siteKey に合わせてください */
/* ▼ 多言語対応：UI言語 & 対応言語一覧 */
import { LANGS, type LangKey } from "@/lib/langs";
import { useUILang, type UILang } from "@/lib/atoms/uiLangAtom";

type MediaType = "image" | "video";

type Section = {
  id: string;
  base: { title: string };
  t: Array<{ lang: LangKey; title?: string }>;
  createdAt?: any;
  order?: number;
};

type ProductDoc = Product & {
  base?: { title: string; body: string };
  t?: Array<{ lang: LangKey; title?: string; body?: string }>;
  sectionId?: string | null;
  mediaURL?: string;
  mediaType?: MediaType;
  originalFileName?: string;
};

function pickLocalized(
  p: ProductDoc,
  lang: UILang
): { title: string; body: string } {
  if (lang === "ja") {
    return {
      title: p.base?.title ?? p.title ?? "",
      body: p.base?.body ?? p.body ?? "",
    };
  }
  const hit = p.t?.find((x) => x.lang === lang);
  return {
    title: hit?.title ?? p.base?.title ?? p.title ?? "",
    body: hit?.body ?? p.base?.body ?? p.body ?? "",
  };
}

type Tr = { lang: LangKey; title: string; body: string };
async function translateAll(titleJa: string, bodyJa: string): Promise<Tr[]> {
  const jobs: Promise<Tr>[] = LANGS.map(async (l) => {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: titleJa, body: bodyJa, target: l.key }),
    });
    if (!res.ok) throw new Error(`translate error: ${l.key}`);
    const data = (await res.json()) as { title?: string; body?: string };
    return {
      lang: l.key,
      title: (data.title ?? "").trim(),
      body: (data.body ?? "").trim(),
    };
  });
  const settled = await Promise.allSettled(jobs);
  return settled
    .filter((r): r is PromiseFulfilledResult<Tr> => r.status === "fulfilled")
    .map((r) => r.value);
}

const TAX_T: Record<UILang, { incl: string; excl: string }> = {
  ja: { incl: "税込", excl: "税抜" },
  en: { incl: "tax included", excl: "tax excluded" },
  zh: { incl: "含税", excl: "不含税" },
  "zh-TW": { incl: "含稅", excl: "未稅" },
  ko: { incl: "부가세 포함", excl: "부가세 별도" },
  fr: { incl: "TTC", excl: "HT" },
  es: { incl: "IVA incluido", excl: "sin IVA" },
  de: { incl: "inkl. MwSt.", excl: "zzgl. MwSt." },
  pt: { incl: "com impostos", excl: "sem impostos" },
  it: { incl: "IVA inclusa", excl: "IVA esclusa" },
  ru: { incl: "с НДС", excl: "без НДС" },
  th: { incl: "รวมภาษี", excl: "ไม่รวมภาษี" },
  vi: { incl: "đã gồm thuế", excl: "chưa gồm thuế" },
  id: { incl: "termasuk pajak", excl: "tidak termasuk pajak" },
  hi: { incl: "कर सहित", excl: "कर के बिना" },
  ar: { incl: "شامل الضريبة", excl: "غير شامل الضريبة" },
};

export default function ProductECDetail({ product }: { product: Product }) {
  // ---------- 権限・テーマ ----------
  const [isAdmin, setIsAdmin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPercent, setUploadingPercent] = useState<number | null>(null);
  const gradient = useThemeGradient();
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setIsAdmin(!!u));
    return () => unsub();
  }, []);

  const isDark = useMemo(() => {
    const darks: ThemeKey[] = ["brandG", "brandH", "brandI"];
    return gradient && darks.some((k) => gradient === THEMES[k]);
  }, [gradient]);

  // ---------- UI言語 ----------
  const { uiLang } = useUILang();
  const taxT = TAX_T[uiLang] ?? TAX_T.ja;

  // ---------- 表示用データ ----------
  const [displayProduct, setDisplayProduct] = useState<ProductDoc>(
    product as ProductDoc
  );

  // ---------- セクション一覧（ピッカー用） ----------
  const [sections, setSections] = useState<Section[]>([]);

  // ---------- 編集モーダル用 state（常に制御） ----------
  const [showEdit, setShowEdit] = useState(false);
  const [title, setTitle] = useState<string>(product.title ?? "");
  const [body, setBody] = useState<string>(product.body ?? "");
  const [price, setPrice] = useState<number | "">(
    typeof product.price === "number" ? product.price : ""
  );
  const [taxIncluded, setTaxIncluded] = useState<boolean>(
    typeof (product as any).taxIncluded === "boolean"
      ? !!(product as any).taxIncluded
      : true
  );
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const uploading = progress !== null;

  // ▼ EC: 数量 / カート投入（スマホ向けUI）
  const [qty, setQty] = useState<number>(1);
  const { add: addToCart } = useCart();
  const [addedToast, setAddedToast] = useState<null | {
    name: string;
    qty: number;
  }>(null);

  const stepQty = (delta: number) => {
    setQty((n) => Math.max(1, Math.min(999, (Number(n) || 1) + delta)));
  };

  const handleQtyInput = (v: string) => {
    // モバイル数値キーボード想定：数字以外除去
    if (v === "") return setQty(1);
    const n = Number(String(v).replace(/[^\d]/g, ""));
    if (!Number.isFinite(n)) return;
    setQty(Math.max(1, Math.min(999, n)));
  };

  const handleAddToCart = () => {
    const unit = Number(displayProduct.price);
    if (!Number.isFinite(unit) || unit < 0) {
      alert("価格が設定されていません");
      return;
    }
    const count = Math.max(1, qty);
    addToCart({
      productId: displayProduct.id,
      name: displayProduct.title,
      unitAmount: unit,
      qty: count,
      imageUrl: displayProduct.mediaURL,
    });
    // 追加通知（遷移しない）
    setAddedToast({ name: displayProduct.title, qty: count });
    setTimeout(() => setAddedToast(null), 2000);
    // ★ カート/他ページに遷移しない（要望反映）
  };

  // セクション選択
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(
    (product as any).sectionId ?? null
  );

  // ---------- 初期化（product変化時に未定義を入れない） ----------
  useEffect(() => {
    setDisplayProduct(product as ProductDoc);
    setSelectedSectionId((product as any).sectionId ?? null);
    setTitle(product.title ?? "");
    setBody(product.body ?? "");
    setPrice(typeof product.price === "number" ? product.price : "");
    setQty(1);
  }, [product]);

  // ---------- セクション購読（order → createdAt） ----------
  useEffect(() => {
    const secRef = collection(db, "siteSections", SITE_KEY, "sections");
    const qy = query(secRef, orderBy("createdAt", "asc"));
    const unsub = onSnapshot(qy, (snap) => {
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

  // ---------- 保存処理（編集：undefined を完全排除） ----------
  const handleSave = async () => {
    if (!title.trim()) return alert("タイトル必須");
    if (price === "") return alert("価格を入力してください");

    setSaving(true);
    try {
      // 既定値で安全化（Firestoreは undefined を許容しない）
      let mediaURL: string = displayProduct.mediaURL ?? "";
      let mediaType: MediaType =
        (displayProduct.mediaType as MediaType) || "image";
      let originalFileName: string =
        (displayProduct as any).originalFileName ?? "";

      if (file) {
        const isVideo = file.type.startsWith("video/");
        mediaType = isVideo ? "video" : "image";

        const isValidImage = IMAGE_MIME_TYPES.includes(file.type);
        const isValidVideo = VIDEO_MIME_TYPES.includes(file.type);
        if (!isValidImage && !isValidVideo) {
          alert("対応形式ではありません");
          setSaving(false);
          return;
        }

        if (isVideo && file.size > 50 * 1024 * 1024) {
          alert("動画は 50 MB 未満にしてください");
          setSaving(false);
          return;
        }

        const ext = isVideo ? extFromMime(file.type) : "jpg";
        const uploadFile = isVideo
          ? file
          : await imageCompression(file, {
              maxWidthOrHeight: 1200,
              maxSizeMB: 0.7,
              useWebWorker: true,
              fileType: "image/jpeg",
              initialQuality: 0.8,
            });

        const storageRef = ref(
          getStorage(),
          `products/public/${SITE_KEY}/${product.id}.${ext}`
        );
        const task = uploadBytesResumable(storageRef, uploadFile, {
          contentType: isVideo ? file.type : "image/jpeg",
        });

        setUploadingPercent(0);
        setProgress(0);
        task.on("state_changed", (s) => {
          const pct = Math.round((s.bytesTransferred / s.totalBytes) * 100);
          setProgress(pct);
          setUploadingPercent(pct);
        });
        await task;

        mediaURL = `${await getDownloadURL(storageRef)}?v=${uuid()}`;
        originalFileName = file.name || originalFileName;
        setProgress(null);
        setUploadingPercent(null);
      }

      const base = { title: title.trim(), body: (body ?? "").trim() };
      let t: Tr[] = [];
      try {
        t = await translateAll(base.title, base.body);
      } catch (e) {
        console.warn("translateAll failed, continue without i18n fields", e);
        t = [];
      }

      // ここで undefined を完全排除して payload を組む
      const priceNumber =
        typeof price === "number" && Number.isFinite(price)
          ? price
          : Number(displayProduct.price) || 0;
      const taxIncludedSafe =
        typeof taxIncluded === "boolean" ? taxIncluded : true; // 既定: 税込
      const mediaTypeSafe: MediaType = mediaType || "image";
      const mediaURLSafe = mediaURL || "";
      const originalFileNameSafe = originalFileName || "";

      const payload = {
        title: base.title,
        body: base.body,
        price: priceNumber,
        taxIncluded: taxIncludedSafe,
        mediaURL: mediaURLSafe,
        mediaType: mediaTypeSafe,
        base,
        t,
        sectionId: selectedSectionId ?? null, // null はOK
        originalFileName: originalFileNameSafe,
        updatedAt: serverTimestamp(),
      } as const;

      await updateDoc(
        doc(db, "siteProducts", SITE_KEY, "items", product.id),
        payload
      );

      // ローカル反映（UI即時更新）
      setDisplayProduct((prev) => ({
        ...(prev as ProductDoc),
        ...payload,
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
  };

  const handleDelete = async () => {
    if (!confirm(`「${displayProduct.title}」を削除しますか？`)) return;
    const storage = getStorage();
    try {
      if (displayProduct.mediaURL) {
        const fileRef = ref(storage, displayProduct.mediaURL);
        try {
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

  if (!displayProduct) {
    return (
      <main className="min-h-screen flex items-center justify-center pt-24">
        <CardSpinner />
      </main>
    );
  }

  const loc = pickLocalized(displayProduct, uiLang);

  return (
    <main className="min-h-screen flex items-start justify-center p-4 pt-24">
      <BusyOverlay uploadingPercent={uploadingPercent} saving={saving} />

      {/* 追加完了の軽量トースト（遷移しない） */}
      <div
        aria-live="polite"
        className={clsx(
          "fixed left-1/2 -translate-x-1/2 top-16 z-40",
          addedToast ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2",
          "transition-all duration-300"
        )}
      >
        {addedToast && (
          <div className="rounded-full bg-black/80 text-white px-4 py-2 text-sm shadow">
            「{addedToast.name}」を {addedToast.qty} 個カートに追加しました
          </div>
        )}
      </div>

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
          isDark ? "bg-black/40 text-white" : "bg-white"
        )}
      >
        {isAdmin && (
          <div className="absolute top-2 right-2 z-20 flex gap-1">
            <button
              onClick={() => setShowEdit(true)}
              className="px-2 py-1 bg-blue-600 text-white text-md rounded shadow disabled:opacity-50"
              type="button"
            >
              編集
            </button>
            <button
              onClick={handleDelete}
              className="px-2 py-1 bg-red-600 text-white text-md rounded shadow disabled:opacity-50"
              type="button"
            >
              削除
            </button>
          </div>
        )}

        {/* メディア */}
        {displayProduct.mediaType === "video" ? (
          <video
            src={displayProduct.mediaURL}
            muted
            playsInline
            autoPlay
            loop
            preload="auto"
            className="w-full aspect-square object-cover"
          />
        ) : (
          <div className="relative w-full aspect-square">
            <Image
              src={displayProduct.mediaURL || "/images/placeholder.jpg"}
              alt={loc.title || displayProduct.title}
              fill
              className="object-cover"
              sizes="100vw"
              unoptimized
            />
          </div>
        )}

        {/* テキスト */}
        <div className="p-4 space-y-3">
          <h1 className={clsx("text-lg font-bold", isDark && "text-white")}>
            {loc.title}
          </h1>
          <p className={clsx("font-semibold", isDark && "text-white")}>
            ¥{Number(displayProduct.price || 0).toLocaleString()}（
            {displayProduct.taxIncluded ? taxT.incl : taxT.excl}）
          </p>
          {loc.body && (
            <p
              className={clsx(
                "text-sm whitespace-pre-wrap leading-relaxed",
                isDark && "text-white"
              )}
            >
              {loc.body}
            </p>
          )}

          {/* ▼ スマホ向け：大型タッチターゲットの数量ステッパー */}
          <div className="flex items-center gap-2 pt-2">
            <label className="text-sm sr-only">数量</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => stepQty(-1)}
                aria-label="数量を1減らす"
                className="h-11 w-11 rounded-xl border text-xl font-bold active:scale-[0.98]"
              >
                −
              </button>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                aria-label="数量を入力"
                className="w-20 h-11 border rounded-xl text-center text-lg"
                value={String(qty)}
                onChange={(e) => handleQtyInput(e.target.value)}
              />
              <button
                type="button"
                onClick={() => stepQty(1)}
                aria-label="数量を1増やす"
                className="h-11 w-11 rounded-xl border text-xl font-bold active:scale-[0.98]"
              >
                ＋
              </button>
            </div>

            <button
              type="button"
              onClick={handleAddToCart}
              className="ml-auto h-11 px-4 rounded-xl bg-black text-white font-semibold"
              aria-label="カートに入れる"
            >
              カートに入れる
            </button>
          </div>
        </div>
      </motion.div>

      {/* 編集モーダル */}
      {isAdmin && showEdit && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md bg-white rounded-lg p-6 space-y-4">
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
                  checked={!!taxIncluded}
                  onChange={() => setTaxIncluded(true)}
                />{" "}
                税込
              </label>
              <label>
                <input
                  type="radio"
                  checked={!taxIncluded}
                  onChange={() => setTaxIncluded(false)}
                />{" "}
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

            <input
              type="file"
              accept={[...IMAGE_MIME_TYPES, ...VIDEO_MIME_TYPES].join(",")}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="bg-gray-500 text-white w-full h-10 px-3 py-1 rounded"
              disabled={uploading}
            />

            {uploading && (
              <div className="w-full flex flex-col items-center gap-2">
                <p>アップロード中… {progress}%</p>
                <div className="w-full h-2 bg-gray-200 rounded">
                  <div
                    className="h-full bg-green-500 rounded transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-center">
              <button
                onClick={handleSave}
                disabled={uploading}
                className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
                type="button"
              >
                更新
              </button>
              <button
                onClick={() => !uploading && setShowEdit(false)}
                disabled={uploading}
                className="px-4 py-2 bg-gray-500 text-white rounded disabled:opacity-50"
                type="button"
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
