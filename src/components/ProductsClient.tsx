"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { Pin, Plus } from "lucide-react";
import { v4 as uuid } from "uuid";
import imageCompression from "browser-image-compression";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
  CollectionReference,
  DocumentData,
  writeBatch,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs,
  QueryDocumentSnapshot,
  where,
  deleteDoc,
} from "firebase/firestore";
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useThemeGradient } from "@/lib/useThemeGradient";
import clsx from "clsx";
import { ThemeKey, THEMES } from "@/lib/themes";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";

import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import SortableItem from "./SortableItem";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import ProductMedia from "./ProductMedia";
import { SITE_KEY } from "@/lib/atoms/siteKeyAtom";

// ▼ 多言語関連
import { LANGS, type LangKey } from "@/lib/langs";
import { useUILang, type UILang } from "@/lib/atoms/uiLangAtom";

// 既存型を尊重しつつ、base/t/sectionId を拡張で扱えるようにする
import { type Product } from "@/types/Product";

// BusyOverlay
import { BusyOverlay } from "./BusyOverlay";

// ▼ 共通ファイル形式ユーティリティ
import {
  IMAGE_MIME_TYPES,
  VIDEO_MIME_TYPES,
  extFromMime,
} from "@/lib/fileTypes";

/* ===================== 多言語用型・ユーティリティ ===================== */
type MediaType = "image" | "video";

type Base = { title: string; body: string };
type Tr = { lang: LangKey; title?: string; body?: string };

/* ▼▼▼ セクション（タイトルのみ、多言語対応） ▼▼▼ */
type Section = {
  id: string;
  base: { title: string }; // body なし（タイトルのみ）
  t: Array<{ lang: LangKey; title?: string }>;
  createdAt?: any;
};

// 表示用：UI言語に応じて title/body を解決（既存 title/body も後方互換で参照）
function displayOf(p: Product & { base?: Base; t?: Tr[] }, lang: UILang): Base {
  const fallback: Base = {
    title: (p as any)?.title ?? "",
    body: (p as any)?.body ?? "",
  };

  // base/t を持たない古いデータは既存の title/body をそのまま表示
  if (!p.base && !p.t) return fallback;

  if (lang === "ja") {
    return p.base ?? fallback;
  }
  const hit = p.t?.find((x) => x.lang === lang);
  return {
    title: (hit?.title ?? p.base?.title ?? fallback.title) || "",
    body: (hit?.body ?? p.base?.body ?? fallback.body) || "",
  };
}

// セクション表示用ローカライズ（タイトルのみ）
function sectionTitleLoc(s: Section, lang: UILang): string {
  if (lang === "ja") return s.base?.title ?? "";
  const hit = s.t?.find((x) => x.lang === lang);
  return hit?.title ?? s.base?.title ?? "";
}

// 本体の一括翻訳（/api/translate を各言語へ）
async function translateAll(titleJa: string, bodyJa: string): Promise<Tr[]> {
  const tasks = LANGS.map(async (l) => {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: titleJa, body: bodyJa, target: l.key }),
    });
    if (!res.ok) throw new Error(`translate failed: ${l.key}`);
    const data = (await res.json()) as { title?: string; body?: string };
    return {
      lang: l.key,
      title: (data.title ?? "").trim(),
      body: (data.body ?? "").trim(),
    };
  });
  return Promise.all(tasks);
}

// セクション（タイトルのみ）の一括翻訳（allSettledではなくallで型を揃える）
type SectionTr = { lang: LangKey; title: string };
async function translateSectionTitleAll(titleJa: string): Promise<SectionTr[]> {
  const jobs: Promise<SectionTr>[] = LANGS.map(async (l) => {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: titleJa, body: "", target: l.key }),
    });
    if (!res.ok) throw new Error(`section translate failed: ${l.key}`);
    const data = (await res.json()) as { title?: string };
    return { lang: l.key, title: (data.title ?? "").trim() };
  });
  return Promise.all(jobs);
}

/* ===================== 税込/税抜の多言語辞書 ===================== */
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

/* ===================== 既存コードの定数 ===================== */

const PAGE_SIZE = 20;
const MAX_VIDEO_SEC = 30;

type ProdDoc = Product & { base?: Base; t?: Tr[]; sectionId?: string | null };

export default function ProductsClient() {
  // ▼ 商品
  const [list, setList] = useState<ProdDoc[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editing, setEditing] = useState<ProdDoc | null>(null);
  const [file, setFile] = useState<File | null>(null);

  // ▼ 原文（日本語）入力
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [price, setPrice] = useState<number | "">("");
  const [taxIncluded, setTaxIncluded] = useState(true);

  // ▼ 新規追加用：セクション選択（★追加）
  const [formSectionId, setFormSectionId] = useState<string>("");

  // 既存アップロード表示
  const [progress, setProgress] = useState<number | null>(null);
  const [uploadingPercent, setUploadingPercent] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const uploading = progress !== null;

  const [aiLoading, setAiLoading] = useState(false);

  // ページング
  const [lastDoc, setLastDoc] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const isFetchingMore = useRef(false);

  // ▼ セクション（カテゴリ）
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>("all");

  // セクション管理モーダル
  const [showSecModal, setShowSecModal] = useState(false);
  const [newSecName, setNewSecName] = useState("");

  const gradient = useThemeGradient();
  const router = useRouter();

  // UI言語
  const { uiLang } = useUILang();
  const taxT = TAX_T[uiLang] ?? TAX_T.ja;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    })
  );

  const isDark = useMemo(() => {
    const darkThemes: ThemeKey[] = ["brandG", "brandH", "brandI"];
    if (!gradient) return false;
    return darkThemes.some((key) => gradient === THEMES[key]);
  }, [gradient]);

  const productColRef: CollectionReference = useMemo(
    () => collection(db, "siteProducts", SITE_KEY, "items"),
    []
  );
  const sectionColRef: CollectionReference = useMemo(
    () => collection(db, "siteSections", SITE_KEY, "sections"),
    []
  );

  const jaCollator = useMemo(
    () => new Intl.Collator("ja-JP", { numeric: true, sensitivity: "base" }),
    []
  );

  useEffect(() => onAuthStateChanged(auth, (u) => setIsAdmin(!!u)), []);

  /* ========== セクション購読（左上ピッカー & 新規追加モーダル用） ========== */
  useEffect(() => {
    const qSec = query(sectionColRef, orderBy("createdAt", "asc"));
    const unsub = onSnapshot(qSec, (snap) => {
      const items: Section[] = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          base: data.base ?? { title: data.title ?? "" },
          t: Array.isArray(data.t) ? data.t : [],
          createdAt: data.createdAt,
        };
      });
      setSections(items);
      // 選択中が消された場合は "all" に戻す
      if (
        selectedSectionId !== "all" &&
        !items.some((s) => s.id === selectedSectionId)
      ) {
        setSelectedSectionId("all");
      }
    });
    return () => unsub();
  }, [sectionColRef, selectedSectionId]);

  /* ========== 初回/フィルタ変更で最初のページを購読 ========== */
  useEffect(() => {
    // リセット
    setList([]);
    setLastDoc(null);
    setHasMore(true);

    if (isFetchingMore.current) return;
    isFetchingMore.current = true;

    const parts: any[] = [productColRef];
    if (selectedSectionId !== "all") {
      parts.push(where("sectionId", "==", selectedSectionId));
    }
    parts.push(orderBy("createdAt", "desc"));
    parts.push(limit(PAGE_SIZE));

    const firstQuery = query(...(parts as Parameters<typeof query>));
    const unsub = onSnapshot(firstQuery, (snap) => {
      const rows: ProdDoc[] = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          title: data.title ?? "",
          body: data.body ?? "",
          price: data.price ?? 0,
          mediaURL: data.mediaURL ?? data.imageURL ?? "",
          mediaType: (data.mediaType ?? "image") as MediaType,
          originalFileName: data.originalFileName,
          taxIncluded: data.taxIncluded ?? true,
          order: data.order ?? 9999,
          base: data.base,
          t: Array.isArray(data.t) ? data.t : [],
          sectionId: data.sectionId ?? null,
        };
      });
      setList(rows);
      setLastDoc(
        (snap.docs.at(-1) as QueryDocumentSnapshot<DocumentData>) || null
      );
      setHasMore(snap.docs.length === PAGE_SIZE);
      isFetchingMore.current = false;
    });

    return () => unsub();
  }, [productColRef, selectedSectionId]);

  /* ========== 追加ページ取得（スクロールで使用） ========== */
  const fetchNextPage = useCallback(async () => {
    if (isFetchingMore.current || !hasMore || !lastDoc) return;
    isFetchingMore.current = true;

    const parts: any[] = [productColRef];
    if (selectedSectionId !== "all") {
      parts.push(where("sectionId", "==", selectedSectionId));
    }
    parts.push(orderBy("createdAt", "desc"));
    parts.push(startAfter(lastDoc));
    parts.push(limit(PAGE_SIZE));

    const nextQuery = query(...(parts as Parameters<typeof query>));
    const snap = await getDocs(nextQuery);

    const nextRows: ProdDoc[] = snap.docs.map((d) => {
      const data = d.data() as any;
      return {
        id: d.id,
        title: data.title ?? "",
        body: data.body ?? "",
        price: data.price ?? 0,
        mediaURL: data.mediaURL ?? data.imageURL ?? "",
        mediaType: (data.mediaType ?? "image") as MediaType,
        originalFileName: data.originalFileName,
        taxIncluded: data.taxIncluded ?? true,
        order: data.order ?? 9999,
        base: data.base,
        t: Array.isArray(data.t) ? data.t : [],
        sectionId: data.sectionId ?? null,
      };
    });

    setList((prev) => [...prev, ...nextRows]);
    setLastDoc(
      (snap.docs.at(-1) as QueryDocumentSnapshot<DocumentData>) || null
    );
    setHasMore(snap.docs.length === PAGE_SIZE);
    isFetchingMore.current = false;
  }, [productColRef, lastDoc, hasMore, selectedSectionId]);

  /* ========== スクロール監視で追加ロード ========== */
  useEffect(() => {
    const handleScroll = () => {
      if (
        hasMore &&
        !uploading &&
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 150
      ) {
        fetchNextPage(); // lastDoc を使用
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [fetchNextPage, hasMore, uploading]);

  /* ========== 並び順リアルタイム（order 反映） ========== */
  useEffect(() => {
    const parts: any[] = [productColRef];
    if (selectedSectionId !== "all") {
      parts.push(where("sectionId", "==", selectedSectionId));
    }
    const unsub = onSnapshot(
      query(...(parts as Parameters<typeof query>)),
      (snap) => {
        const rows: ProdDoc[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            title: data.title,
            body: data.body,
            price: data.price ?? 0,
            mediaURL: data.mediaURL ?? data.imageURL ?? "",
            mediaType: (data.mediaType ?? "image") as MediaType,
            originalFileName: data.originalFileName,
            taxIncluded: data.taxIncluded ?? true,
            order: data.order ?? 9999,
            base: data.base,
            t: Array.isArray(data.t) ? data.t : [],
            sectionId: data.sectionId ?? null,
          };
        });
        rows.sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
        setList(rows);
      }
    );
    return () => unsub();
  }, [productColRef, jaCollator, selectedSectionId]);

  /* ========== 商品保存（新規追加時にセクションIDを保存） ========== */
  const saveProduct = async () => {
    if (uploading) return;
    if (!title.trim()) return alert("タイトル必須");
    if (price === "") return alert("価格を入力してください");
    if (formMode === "add" && !file) return alert("メディアを選択してください");

    setSaving(true);
    try {
      const id = editing?.id ?? uuid();
      let mediaURL = editing?.mediaURL ?? "";
      let mediaType: MediaType = editing?.mediaType ?? "image";

      if (formMode === "add" && !file)
        return alert("メディアを選択してください");

      if (file) {
        const isVideo = file.type.startsWith("video/");
        mediaType = isVideo ? "video" : "image";

        const isValidVideo = VIDEO_MIME_TYPES.includes(file.type);
        const isValidImage = IMAGE_MIME_TYPES.includes(file.type);

        if (!isValidImage && !isValidVideo) {
          alert(
            "対応形式：画像（JPEG, PNG, WEBP, GIF）／動画（MP4, MOV など）"
          );
          setSaving(false);
          return;
        }

        // 画像は JPEG へ圧縮・変換するため拡張子は jpg、動画は MIME から拡張子を得る
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

        const storageRef = ref(
          getStorage(),
          `products/public/${SITE_KEY}/${id}.${ext}`
        );

        const task = uploadBytesResumable(storageRef, uploadFile, {
          contentType: isVideo ? file.type : "image/jpeg",
        });

        setProgress(0);
        setUploadingPercent(0);
        task.on("state_changed", (s) => {
          const pct = Math.round((s.bytesTransferred / s.totalBytes) * 100);
          setProgress(pct);
          setUploadingPercent(pct);
        });
        await task;

        const downloadURL = await getDownloadURL(storageRef);
        if (!downloadURL) throw new Error("画像URLの取得に失敗しました");

        // キャッシュバスターで強制更新
        mediaURL = `${downloadURL}?v=${uuid()}`;
        setProgress(null);
        setUploadingPercent(null);

        // 拡張子変更に伴う旧ファイル削除（既存は mp4/jpg 想定のまま）
        if (formMode === "edit" && editing) {
          const oldExt = editing.mediaType === "video" ? "mp4" : "jpg";
          if (oldExt !== ext) {
            await deleteObject(
              ref(getStorage(), `products/public/${SITE_KEY}/${id}.${oldExt}`)
            ).catch(() => {});
          }
        }
      }

      // ▼ 多言語保存：原文（日本語）→ 全言語翻訳して base/t を保存
      const base: Base = { title: title.trim(), body: body.trim() };
      const t: Tr[] = await translateAll(base.title, base.body);

      type ProductPayload = {
        // 既存互換フィールド（UIは変えない）
        title: string;
        body: string;
        price: number;
        mediaURL: string;
        mediaType: "image" | "video";
        originalFileName?: string;
        taxIncluded: boolean;

        // 多言語フィールド（追加）
        base: Base;
        t: Tr[];

        // ★ 新規追加時のみセクションIDを保存
        sectionId?: string | null;
      };

      const payload: ProductPayload = {
        // 既存互換として title/body に原文（日本語）を維持
        title: base.title,
        body: base.body,
        price: Number(price),
        mediaURL,
        mediaType,
        taxIncluded,
        base,
        t,
      };

      // originalFileName があるときだけ追加
      const originalFileName = file?.name || editing?.originalFileName;
      if (originalFileName) {
        payload.originalFileName = originalFileName;
      }

      // ★ 新規追加時のみセクションIDを反映（編集はここでは触らない）
      if (formMode === "add") {
        payload.sectionId = formSectionId ? formSectionId : null;
      }

      if (formMode === "edit" && editing) {
        await updateDoc(doc(productColRef, id), payload);
      } else {
        await addDoc(productColRef, {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }

      closeForm();
    } catch (e) {
      console.error(e);
      alert("保存に失敗しました。対応形式や容量をご確認ください。");
      setProgress(null);
      setUploadingPercent(null);
    } finally {
      setSaving(false);
    }
  };

  const openAdd = () => {
    if (uploading) return;
    resetFields();
    setFormSectionId(""); // ★ 新規追加時はセクション未設定で開始
    setFormMode("add");
  };
  // const openEdit = (p: Product) => { ... }

  const closeForm = () => {
    if (uploading) return;
    setTimeout(() => {
      resetFields();
      setFormMode(null);
    }, 100);
  };

  const resetFields = () => {
    setEditing(null);
    setTitle("");
    setBody("");
    setPrice("");
    setFile(null);
    setFormSectionId(""); // ★ リセット
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = list.findIndex((item) => item.id === active.id);
    const newIndex = list.findIndex((item) => item.id === over.id);
    const newList = arrayMove(list, oldIndex, newIndex);
    setList(newList);

    const batch = writeBatch(db);
    newList.forEach((item, index) => {
      batch.update(doc(productColRef, item.id), { order: index });
    });
    await batch.commit();
  };

  /* ========== セクション追加（モーダル） ========== */
  const handleAddSection = async () => {
    const titleJa = newSecName.trim();
    if (!titleJa) return;
    // 重複チェック（原文タイトル）
    if (sections.some((s) => s.base.title === titleJa)) {
      alert("同名のセクションが既に存在します");
      return;
    }
    try {
      setSaving(true);
      const t = await translateSectionTitleAll(titleJa);
      await addDoc(sectionColRef, {
        base: { title: titleJa },
        t,
        createdAt: serverTimestamp(),
      });
      setNewSecName("");
      setShowSecModal(false);
    } catch (e) {
      console.error(e);
      alert("セクションの追加に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  /* ========== セクション削除（モーダル） ========== */
  const handleDeleteSection = async (id: string) => {
    if (!confirm("このセクションを削除しますか？")) return;
    try {
      await deleteDoc(doc(sectionColRef, id));
      if (selectedSectionId === id) setSelectedSectionId("all");
      // 新規追加モーダルで選択していた場合も消しておく
      if (formSectionId === id) setFormSectionId("");
    } catch (e) {
      console.error(e);
      alert("セクションの削除に失敗しました");
    }
  };

  const currentSectionLabel = useMemo(() => {
    if (selectedSectionId === "all") return "全カテゴリー";
    const hit = sections.find((s) => s.id === selectedSectionId);
    return hit ? sectionTitleLoc(hit, uiLang) : "";
  }, [selectedSectionId, sections, uiLang]);

  if (!gradient) return null;

  return (
    <main className="max-w-5xl mx-auto p-4 pt-10">
      {/* BusyOverlay：アップロード中 or 保存中 */}
      <BusyOverlay uploadingPercent={uploadingPercent} saving={saving} />

      <div className="mb-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        {/* セクションピッカー（全員表示） */}
        <div className="flex items-center gap-2">
          <label className="text-sm opacity-70">表示カテゴリ:</label>

          {/* 表示だけオーバーレイするラッパー */}
          <div className="relative inline-block">
            {/* ネイティブ select（ドロップダウンはそのまま） */}
            <select
              className={clsx(
                "border rounded  px-3 py-2 pr-8", // 右矢印の余白分 pr を少し広めに
                "text-transparent caret-transparent selection:bg-transparent", // ← ネイティブ表示を不可視化
                "appearance-none" // 余分な装飾を消したい場合
              )}
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
            >
              <option value="all">全カテゴリー</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {sectionTitleLoc(s, uiLang)}
                </option>
              ))}
            </select>

            {/* ← 常に表示される“見た目用テキスト”だけ白＋アウトラインに */}
            <span
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white text-outline"
            >
              {currentSectionLabel}
            </span>

            {/* ネイティブの矢印を残しつつ、見た目を少し整えたい場合（任意） */}
            {/* <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-sm opacity-60">▾</span> */}
          </div>
        </div>

        {/* セクション管理（管理者のみ表示） */}
        {isAdmin && (
          <button
            onClick={() => setShowSecModal(true)}
            className="px-3 py-2 rounded bg-blue-600 text-white shadow hover:bg-blue-700"
          >
            セクション管理
          </button>
        )}
      </div>

      {/* ▼ セクション管理モーダル */}
      {showSecModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md bg-white rounded-lg p-6 space-y-4">
            <h2 className="text-xl font-bold text-center">セクション管理</h2>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="セクション名（例：クレープ）"
                value={newSecName}
                onChange={(e) => setNewSecName(e.target.value)}
                className="flex-1 border px-3 py-2 rounded"
              />
              <button
                onClick={handleAddSection}
                disabled={!newSecName.trim() || saving}
                className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
              >
                追加
              </button>
            </div>

            <div className="max-h-72 overflow-auto space-y-2">
              {sections.length === 0 && (
                <p className="text-sm text-gray-500">
                  セクションはまだありません。
                </p>
              )}
              {sections.map((s) => (
                <div
                  key={s.id}
                  className="flex justify-between items-center border px-3 py-2 rounded"
                >
                  <span className="truncate">{sectionTitleLoc(s, uiLang)}</span>
                  <button
                    onClick={() => handleDeleteSection(s.id)}
                    className="text-red-600 hover:underline"
                  >
                    削除
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowSecModal(false)}
              className="w-full mt-2 px-4 py-2 bg-gray-500 text-white rounded"
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      {/* ▼ 商品一覧（既存のドラッグ並び替え含む） */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={list.map((p) => p.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-2 lg:grid-cols-2 items-stretch">
            {list.map((p) => {
              // ▼ 多言語表示：UI言語に応じて見出しを決定
              const loc = displayOf(p, uiLang);
              return (
                <SortableItem key={p.id} product={p}>
                  {({ listeners, attributes, isDragging }) => (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 20 }}
                      transition={{ duration: 0.3 }}
                      onClick={() => {
                        if (isDragging) return;
                        router.push(`/products/${p.id}`);
                      }}
                      className={clsx(
                        "flex flex-col h-full border shadow relative transition-colors duration-200",
                        "bg-gradient-to-b",
                        gradient,
                        isDragging
                          ? "bg-yellow-100"
                          : isDark
                          ? "bg-black/40 text-white"
                          : "bg-white",
                        "cursor-pointer",
                        !isDragging && "hover:shadow-lg",
                        // ここには overflow-hidden を付けない！
                        "rounded-b-lg rounded-t-xl"
                      )}
                    >
                      {auth.currentUser !== null && (
                        <div
                          {...attributes}
                          {...listeners}
                          onClick={(e) => e.stopPropagation()} // カード遷移を防止
                          onTouchStart={(e) => e.preventDefault()} // ロングタップ誤作動防止
                          onContextMenu={(e) => e.preventDefault()} // 右クリックメニュー抑止
                          draggable={false} // ネイティブD&D無効化
                          className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 z-30 cursor-grab active:cursor-grabbing touch-none select-none p-3"
                          role="button"
                          aria-label="並び替え"
                        >
                          {/* 白い丸い土台（影付き） */}
                          <div className="w-10 h-10 rounded-full bg-white/95 flex items-center justify-center shadow pointer-events-none">
                            <Pin />
                          </div>
                        </div>
                      )}

                      {/* メディア表示（既存のまま） */}
                      <ProductMedia
                        src={p.mediaURL}
                        type={p.mediaType}
                        className="rounded-t-xl"
                      />

                      {/* 商品情報（タイトルは多言語化／税込表示は辞書化） */}
                      <div className="p-1 space-y-1">
                        <h2
                          className={clsx("text-sm font-bold", {
                            "text-white": isDark,
                          })}
                        >
                          {loc.title || p.title || "（無題）"}
                        </h2>

                        <p
                          className={clsx("font-semibold", {
                            "text-white": isDark,
                          })}
                        >
                          ¥{(p.price ?? 0).toLocaleString()}（
                          {p.taxIncluded ? taxT.incl : taxT.excl}）
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

      {/* ▼ 既存：新規商品追加ボタン（FAB） */}
      {isAdmin && formMode === null && (
        <button
          onClick={openAdd}
          aria-label="新規追加"
          disabled={uploading}
          className="fixed bottom-6 right-6 z-20 w-14 h-14 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-lg hover:bg-pink-700 active:scale-95 transition disabled:opacity-50 cursor-pointer"
        >
          <Plus size={28} />
        </button>
      )}

      {/* ▼ 既存：新規追加/編集モーダル（★新規追加時のみセクションピッカー追加） */}
      {isAdmin && formMode && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md bg-white rounded-lg p-6 space-y-4">
            <h2 className="text-xl font-bold text-center">
              {formMode === "edit" ? "商品を編集" : "新規商品追加"}
            </h2>

            {/* ★ 新規追加時のみ：セクションピッカー */}
            {formMode === "add" && (
              <div className="flex flex-col gap-1">
                <label className="text-sm">セクション（カテゴリー）</label>
                <select
                  value={formSectionId}
                  onChange={(e) => setFormSectionId(e.target.value)}
                  className="w-full border px-3 py-2 rounded bg-white"
                >
                  <option value="">全カテゴリー</option>
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {sectionTitleLoc(s, uiLang)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 原文（日本語）入力は既存のまま維持 */}
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
              onChange={(e) => {
                const val = e.target.value;
                setPrice(val === "" ? "" : Number(val));
              }}
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
                {/* 日本語固定 */}
                税込
              </label>
              <label>
                <input
                  type="radio"
                  checked={!taxIncluded}
                  onChange={() => setTaxIncluded(false)}
                />
                {/* 日本語固定 */}
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

            {/* 既存の AI 生成ボタンはそのまま（結果は日本語本文へ） */}
            <button
              onClick={async () => {
                if (!title) return alert("タイトルを入力してください");
                setAiLoading(true);
                try {
                  const res = await fetch("/api/generate-description", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ title, price }),
                  });

                  const data = await res.json();
                  if (data.body) {
                    setBody(data.body);
                  } else {
                    alert("生成に失敗しました");
                  }
                } catch {
                  alert("エラーが発生しました");
                } finally {
                  setAiLoading(false);
                }
              }}
              disabled={uploading || aiLoading}
              className="w-full mt-2 px-4 py-2 bg-purple-600 text-white rounded disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {aiLoading ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
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
                  <span>生成中…</span>
                </>
              ) : (
                "AIで紹介文を生成"
              )}
            </button>

            <input
              type="file"
              accept={[...IMAGE_MIME_TYPES, ...VIDEO_MIME_TYPES].join(",")}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;

                /* --- 動画かどうか判定 --- */
                const isVideo = f.type.startsWith("video/");
                if (!isVideo) {
                  setFile(f);
                  return;
                }

                /* --- <video> でメタデータだけ読む --- */
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
                  setFile(f);
                };
              }}
              className="bg-gray-500 text-white w-full h-10 px-3 py-1 rounded"
              disabled={uploading}
            />
            {formMode === "edit" && editing?.originalFileName && (
              <p className="text-sm text-gray-600">
                現在のファイル: {editing.originalFileName}
              </p>
            )}

            <div className="flex gap-2 justify-center">
              <button
                onClick={saveProduct}
                disabled={uploading}
                className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
              >
                {formMode === "edit" ? "更新" : "追加"}
              </button>
              <button
                onClick={closeForm}
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
