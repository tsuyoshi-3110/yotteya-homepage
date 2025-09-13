"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import clsx from "clsx";

import { v4 as uuid } from "uuid";
import imageCompression from "browser-image-compression";

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
import CardSpinner from "./CardSpinner";
import { BusyOverlay } from "./BusyOverlay";

/* 追加：共通ファイル形式ユーティリティを使用 */
import {
  IMAGE_MIME_TYPES,
  VIDEO_MIME_TYPES,
  extFromMime,
} from "@/lib/fileTypes";

/* あなたの siteKey に合わせてください */
const SITE_KEY = "yotteya";

import { motion } from "framer-motion";

/* ▼ 多言語対応：UI言語 & 対応言語一覧 */
import { LANGS, type LangKey } from "@/lib/langs";
import { useUILang, type UILang } from "@/lib/atoms/uiLangAtom";

type MediaType = "image" | "video";

/* ▼ セクション（タイトルのみ、多言語対応・order対応） */
type Section = {
  id: string;
  base: { title: string };
  t: Array<{ lang: LangKey; title?: string }>;
  createdAt?: any;
  order?: number; // ← 並べ替え順を反映
};

type ProductDoc = Product & {
  base?: { title: string; body: string };
  t?: Array<{ lang: LangKey; title?: string; body?: string }>;
  sectionId?: string | null;
};



/* ▼ 表示用：UI 言語に応じてタイトル/本文を解決 */
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

function sectionTitleLoc(s: Section, lang: UILang): string {
  if (lang === "ja") return s.base?.title ?? "";
  const hit = s.t?.find((x) => x.lang === lang);
  return hit?.title ?? s.base?.title ?? "";
}

/* ▼ 保存時に日本語→各言語へ翻訳（/api/translate を使用） */
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

/* 税込/税抜 表示の多言語辞書（既存） */
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

export default function ProductDetail({ product }: { product: Product }) {
  /* ---------- 権限・テーマ ---------- */
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

  /* ---------- UI言語 ---------- */
  const { uiLang } = useUILang();
  const taxT = TAX_T[uiLang] ?? TAX_T.ja;

  /* ---------- 表示用データ ---------- */
  const [displayProduct, setDisplayProduct] = useState<ProductDoc>(
    product as ProductDoc
  );

  /* ---------- セクション一覧（ピッカー用） ---------- */
  const [sections, setSections] = useState<Section[]>([]);

  /* ---------- 編集モーダル用 state ---------- */
  const [showEdit, setShowEdit] = useState(false);
  const [title, setTitle] = useState(product.title);
  const [body, setBody] = useState<string>(product.body ?? ""); // ← 空文字で安全化
  const [price, setPrice] = useState<number | "">(product.price);
  const [taxIncluded, setTaxIncluded] = useState(product.taxIncluded);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const uploading = progress !== null;

  // セクション選択（編集モーダルに表示）
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(
    (product as any).sectionId ?? null
  );

  /* ---------- 初期化 ---------- */
  useEffect(() => {
    setDisplayProduct(product as ProductDoc);
    setSelectedSectionId((product as any).sectionId ?? null);
    setBody(product.body ?? ""); // ← 再マウント時も安全化
  }, [product]);

  /* ---------- セクション購読（← ここを order 順に） ---------- */
  useEffect(() => {
    const secRef = collection(db, "siteSections", SITE_KEY, "sections");
    const q = query(secRef, orderBy("createdAt", "asc")); // FirestoreはcreatedAtで取得
    const unsub = onSnapshot(q, (snap) => {
      const rows: Section[] = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          base: data.base ?? { title: data.title ?? "" },
          t: Array.isArray(data.t) ? data.t : [],
          createdAt: data.createdAt,
          order: typeof data.order === "number" ? data.order : undefined, // 追加
        };
      });

      // 並び替えた順に統一（order → createdAt）
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

  // 編集保存（本体＋セクションIDを保存）
  const handleSave = async () => {
    if (!title.trim()) return alert("タイトル必須");
    if (price === "") return alert("価格を入力してください");

    setSaving(true); // BusyOverlay 用
    try {
      let mediaURL = displayProduct.mediaURL;
      let mediaType: MediaType = displayProduct.mediaType;
      let originalFileName: string | undefined = displayProduct.originalFileName;

      /* 画像 / 動画を差し替える場合のみアップロード */
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

        // 画像は JPEG で保存するため拡張子は強制的に jpg（元の仕様踏襲）
        const ext = isVideo ? extFromMime(file.type) : "jpg";
        const uploadFile = isVideo
          ? file
          : await imageCompression(file, {
              maxWidthOrHeight: 1200,
              maxSizeMB: 0.7,
              useWebWorker: true,
              fileType: "image/jpeg", // JPEGでアップロード
              initialQuality: 0.8,
            });

        /* Storage へアップロード */
        const storageRef = ref(
          getStorage(),
          `products/public/${SITE_KEY}/${product.id}.${ext}`
        );
        const task = uploadBytesResumable(storageRef, uploadFile, {
          contentType: isVideo ? file.type : "image/jpeg",
        });

        setProgress(0);
        setUploadingPercent(0); // BusyOverlay 連動

        task.on("state_changed", (s) => {
          const pct = Math.round((s.bytesTransferred / s.totalBytes) * 100);
          setProgress(pct);
          setUploadingPercent(pct); // BusyOverlay 連動
        });

        await task;

        mediaURL = `${await getDownloadURL(storageRef)}?v=${uuid()}`;
        originalFileName = file.name; // アップ元の名前（表示・参考用）
        setProgress(null);
        setUploadingPercent(null); // BusyOverlay 連動
      }

      /* ▼▼▼ 多言語フィールドの生成と保存（既存） ▼▼▼ */
      const base = { title: title.trim(), body: (body ?? "").trim() };
      const t = await translateAll(base.title, base.body);

      /* Firestore 更新（sectionId を追記保存） */
      await updateDoc(doc(db, "siteProducts", SITE_KEY, "items", product.id), {
        title: base.title,
        body: base.body,
        price: Number(price),
        taxIncluded,
        mediaURL,
        mediaType,
        base,
        t,
        sectionId: selectedSectionId ?? null,
        originalFileName: originalFileName ?? displayProduct.originalFileName,
        updatedAt: serverTimestamp(),
      });

      /* ローカル表示も即更新 */
      setDisplayProduct((prev) => ({
        ...(prev as ProductDoc),
        title: base.title,
        body: base.body,
        price: typeof price === "number" ? price : 0,
        taxIncluded,
        mediaURL,
        mediaType,
        base,
        t,
        sectionId: selectedSectionId ?? null,
        originalFileName: originalFileName ?? (prev as any).originalFileName,
      }));

      setShowEdit(false);
    } catch (err) {
      console.error(err);
      alert("保存に失敗しました");
      setProgress(null);
      setUploadingPercent(null);
    } finally {
      setSaving(false); // BusyOverlay 用
    }
  };

  // 削除（Storage は mediaURL の拡張子から安全に削除）
  // 置き換え前:
  // const ext = displayProduct.mediaType === "video" ? "mp4" : "jpg";
  // await deleteObject(ref(getStorage(), `products/public/${SITE_KEY}/${product.id}.${ext}`)).catch(() => {});

  const handleDelete = async () => {
    if (!confirm(`「${displayProduct.title}」を削除しますか？`)) return;

    const storage = getStorage();

    try {
      // 1) 先に Storage を“実URL”から直接削除
      //    ※ ref は https ダウンロードURLでも OK。クエリ('?token=...')付きでも動きます。
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

      // 2) Firestore ドキュメント削除
      await deleteDoc(doc(db, "siteProducts", SITE_KEY, "items", product.id));

      // 3) 戻る
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

  /* ▼ 表示テキストは UI 言語に応じて解決（価格表記などは従来どおり日本語のまま） */
  const loc = pickLocalized(displayProduct, uiLang);

  /* ---------- JSX ---------- */
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
          isDark ? "bg-black/40 text-white" : "bg-white"
        )}
      >
        {/* 編集・削除 */}
        {isAdmin && (
          <div className="absolute top-2 right-2 z-20 flex gap-1">
            <button
              onClick={() => setShowEdit(true)}
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

        {/* メディア */}
        {displayProduct.mediaType === "image" ? (
          <div className="relative w-full aspect-square">
            <Image
              src={displayProduct.mediaURL}
              alt={loc.title || displayProduct.title}
              fill
              className="object-cover"
              sizes="100vw"
              unoptimized
            />
          </div>
        ) : (
          <video
            src={displayProduct.mediaURL}
            muted
            playsInline
            autoPlay
            loop
            preload="auto"
            className="w-full aspect-square object-cover"
          />
        )}

        {/* テキスト（タイトル/本文のみ多言語化、他は既存のまま） */}
        <div className="p-4 space-y-2">
          <h1 className={clsx("text-lg font-bold", isDark && "text-white")}>
            {loc.title}
          </h1>
          <p className={clsx("font-semibold", isDark && "text-white")}>
            ¥{displayProduct.price.toLocaleString()}（
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
        </div>
      </motion.div>

      {/* ---------- 編集モーダル ---------- */}
      {isAdmin && showEdit && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md bg-white rounded-lg p-6 space-y-4">
            <h2 className="text-xl font-bold text-center">商品を編集</h2>

             {/* ▼ セクションピッカー（管理画面の order 順を反映） */}
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
                <option value="">全カテゴリー</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {sectionTitleLoc(s, uiLang)}
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
                />
                {/* ← 多言語をやめて日本語固定 */}
                税込
              </label>
              <label>
                <input
                  type="radio"
                  checked={!taxIncluded}
                  onChange={() => setTaxIncluded(false)}
                />
                {/* ← 多言語をやめて日本語固定 */}
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
              >
                更新
              </button>
              <button
                onClick={() => !uploading && setShowEdit(false)}
                disabled={uploading}
                className="px-4 py-2 bg-gray-500 text白 rounded disabled:opacity-50"
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
