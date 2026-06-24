"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { motion } from "framer-motion";
import imageCompression from "browser-image-compression";
import { v4 as uuid } from "uuid";

import { useThemeGradient } from "@/lib/useThemeGradient";
import { ThemeKey, THEMES } from "@/lib/themes";
import { type Product } from "@/types/Product";

import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  getStorage,
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  listAll,
} from "firebase/storage";

import { useSiteKey } from "@/lib/atoms/siteKeyAtom";
import { LANGS, type LangKey } from "@/lib/langs";
import { useUILang, type UILang } from "@/lib/atoms/uiLangAtom";

// 共通UI/ユーティリティ
import { BusyOverlay } from "./BusyOverlay";
import ProductMedia from "./ProductMedia";
import {
  IMAGE_MIME_TYPES,
  VIDEO_MIME_TYPES,
  extFromMime,
} from "@/lib/fileTypes";

// サムネ一覧（削除/並べ替え）
import { GripVertical } from "lucide-react";
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
  useSortable,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/* ---------- 型 ---------- */
type MediaType = "image" | "video";

type MediaItem = { src: string; type: MediaType };

type ProductDoc = Product & {
  base?: { title: string; body: string };
  t?: Array<{ lang: LangKey; title?: string; body?: string }>;
  // 施工実績 ←→ 店舗の紐づけ（任意）
  storeLink?: { storeId: string; placeId?: string };

  // ✅ 複数メディア（画像最大5 + 動画最大1）
  mediaItems?: MediaItem[];
  // ✅ Storage削除用（あれば確実に消せる）
  mediaPaths?: string[];
};

/* ---------- 多言語ユーティリティ ---------- */
function pickLocalized(
  p: ProductDoc,
  lang: UILang,
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

/* ---------- メディア制限 ---------- */
const MAX_VIDEO_SEC = 60;

async function getVideoDurationSec(f: File): Promise<number> {
  const blobUrl = URL.createObjectURL(f);
  try {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.src = blobUrl;

    await new Promise<void>((resolve, reject) => {
      v.onloadedmetadata = () => resolve();
      v.onerror = () => reject(new Error("video metadata load failed"));
    });

    return Number.isFinite(v.duration) ? v.duration : 0;
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

/* ---------- 編集用メディア ---------- */
type EditMedia = {
  id: string;
  type: MediaType;
  kind: "remote" | "local";
  src: string; // remote=URL / local=objectURL
  file?: File; // localのみ
  path?: string; // remote/local 両方で保持（localは保存後に入る）
};

function SortableThumb({
  item,
  onRemove,
}: {
  item: EditMedia;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  // src が変わったらローダーを戻す
  useEffect(() => {
    setReady(false);
    setFailed(false);
  }, [item.src]);

  return (
    <div ref={setNodeRef} style={style} className="shrink-0">
      {/* サムネ枠 */}
      <div className="relative w-16 h-16 rounded overflow-hidden border bg-gray-100">
        {/* ローディング表示 */}
        {!ready && !failed && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/80 border-t-transparent" />
          </div>
        )}

        {/* 読み込み失敗時の簡易表示（真っ黒のままを回避） */}
        {failed && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 text-white text-[10px] font-bold">
            取得失敗
          </div>
        )}

        {item.type === "video" ? (
          <video
            key={item.src} // 再マウントでイベント取りこぼしを避ける
            src={item.src}
            className="w-full h-full object-cover"
            muted
            playsInline
            // サムネは“表示が目的”なので auto に寄せる
            preload="auto"
            // ✅ metadata 取得時点でローダー解除（ここが重要）
            onLoadedMetadata={() => setReady(true)}
            onError={() => {
              setFailed(true);
              setReady(true); // ローダー出っぱなし回避
            }}
          />
        ) : (
          <img
            src={item.src}
            className="w-full h-full object-cover"
            alt=""
            onLoad={() => setReady(true)}
            onError={() => {
              setFailed(true);
              setReady(true);
            }}
          />
        )}

        {/* ドラッグハンドル（下部） */}
        <div
          {...attributes}
          {...listeners}
          className="absolute bottom-0 left-0 right-0 h-7 bg-black/45 text-white flex items-center justify-center touch-none z-20"
          role="button"
          aria-label="並べ替え"
        >
          <GripVertical size={18} />
        </div>
      </div>

      {/* 削除ボタン（下側） */}
      <button
        type="button"
        onClick={() => onRemove(item.id)}
        className="mt-1 w-16 h-8 rounded border bg-white text-xs font-bold"
        aria-label="削除"
      >
        削除
      </button>
    </div>
  );
}

/* ---------- 本体 ---------- */
export default function ProjectsDetail({ product }: { product: Product }) {
  const siteKey = useSiteKey();
  const router = useRouter();

  // 権限
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => onAuthStateChanged(auth, (u) => setIsAdmin(!!u)), []);

  // テーマ
  const gradient = useThemeGradient();
  const isDark = useMemo(() => {
    const darks: ThemeKey[] = ["brandG", "brandH", "brandI"];
    return !!gradient && darks.some((k) => gradient === THEMES[k]);
  }, [gradient]);

  // 表示言語
  const { uiLang } = useUILang();

  // Firestore の全文
  const [docData, setDocData] = useState<ProductDoc>({ ...product });

  // 編集モード
  const [showEdit, setShowEdit] = useState(false);
  const [titleJa, setTitleJa] = useState(product.title ?? "");
  const [bodyJa, setBodyJa] = useState(product.body ?? "");

  // メディア（編集用：一覧/削除/並べ替え）
  const [editMedia, setEditMedia] = useState<EditMedia[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const uploading = progress !== null;
  const [saving, setSaving] = useState(false);

  // AI 本文生成
  const [showBodyGen, setShowBodyGen] = useState(false);
  const [aiKeywords, setAiKeywords] = useState<string[]>(["", "", ""]);
  const [aiGenLoading, setAiGenLoading] = useState(false);
  const canOpenBodyGen = Boolean(titleJa?.trim());
  const canGenerateBody = aiKeywords.some((k) => k.trim());

  // 初回 Firestore 読み直し
  useEffect(() => {
    (async () => {
      // 商品読み直し
      const docRef = doc(db, "siteProjects", siteKey, "items", product.id);
      const snap = await getDoc(docRef);
      const d = snap.data() as any;
      if (d) {
        const merged: ProductDoc = { ...product, ...(d as ProductDoc) };
        setDocData(merged);
        setTitleJa(merged.base?.title ?? merged.title ?? "");
        setBodyJa(merged.base?.body ?? merged.body ?? "");
      }
    })();
  }, [product.id, product]);

  const display = pickLocalized(docData, uiLang);

  // 本文AI生成
  const generateBodyWithAI = async () => {
    if (!titleJa.trim()) {
      alert("タイトルを入力してください");
      return;
    }
    try {
      setAiGenLoading(true);
      const keywords = aiKeywords.filter((k) => k.trim());
      const res = await fetch("/api/generate-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: titleJa, keywords }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "生成に失敗しました");
      const newBody = (data?.body ?? "").trim();
      if (!newBody) return alert("有効な本文が返りませんでした。");
      setBodyJa(newBody);
      setShowBodyGen(false);
      setAiKeywords(["", "", ""]);
    } catch {
      alert("本文生成に失敗しました");
    } finally {
      setAiGenLoading(false);
    }
  };

  // 編集モーダルを開くときに、現在のメディアを editMedia に反映
  const openEdit = () => {
    const items =
      (docData.mediaItems?.length ? docData.mediaItems : undefined) ??
      (docData.mediaURL
        ? [
            {
              src: docData.mediaURL,
              type: (docData.mediaType as MediaType) ?? "image",
            },
          ]
        : []);

    const paths = Array.isArray(docData.mediaPaths) ? docData.mediaPaths : [];

    setEditMedia(
      items.map((m, i) => ({
        id: `${product.id}_remote_${i}`,
        type: m.type,
        kind: "remote",
        src: m.src,
        path: paths[i] || undefined,
      })),
    );

    setShowEdit(true);
  };

  const revokeLocalUrls = (items: EditMedia[]) => {
    items.forEach((m) => {
      if (m.kind === "local" && m.src?.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(m.src);
        } catch {}
      }
    });
  };

  const onRemoveMedia = (id: string) => {
    setEditMedia((prev) => {
      const hit = prev.find((x) => x.id === id);
      if (hit?.kind === "local") revokeLocalUrls([hit]);
      return prev.filter((x) => x.id !== id);
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
  );

  const onDragEndThumb = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setEditMedia((prev) => {
      const oldIndex = prev.findIndex((x) => x.id === active.id);
      const newIndex = prev.findIndex((x) => x.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  // ファイル追加（画像5 / 動画1 制限）
  const onPickFiles = async (fileList: FileList | null) => {
    const picked = Array.from(fileList || []);
    if (picked.length === 0) return;

    const curImages = editMedia.filter((m) => m.type === "image").length;
    const curVideos = editMedia.filter((m) => m.type === "video").length;

    const next: EditMedia[] = [];
    let img = curImages;
    let vid = curVideos;

    for (const f of picked) {
      const isVideo = f.type.startsWith("video/");
      const isImage = f.type.startsWith("image/");

      const okVideo = isVideo && VIDEO_MIME_TYPES.includes(f.type);
      const okImage = isImage && IMAGE_MIME_TYPES.includes(f.type);
      if (!okVideo && !okImage) continue;

      if (okVideo) {
        if (vid >= 1) continue;

        const sec = await getVideoDurationSec(f).catch(() => 0);
        if (sec > MAX_VIDEO_SEC) {
          alert(`動画は ${MAX_VIDEO_SEC} 秒以内にしてください`);
          continue;
        }

        const url = URL.createObjectURL(f);
        next.push({
          id: `${product.id}_local_${uuid()}`,
          type: "video",
          kind: "local",
          src: url,
          file: f,
        });
        vid += 1;
        continue;
      }

      if (img >= 5) continue;

      const url = URL.createObjectURL(f);
      next.push({
        id: `${product.id}_local_${uuid()}`,
        type: "image",
        kind: "local",
        src: url,
        file: f,
      });
      img += 1;
    }

    if (next.length === 0) {
      alert("追加できるファイルがありません（画像は最大5枚、動画は最大1本）");
      return;
    }

    setEditMedia((prev) => [...prev, ...next]);
  };

  // 保存
  const handleSave = async () => {
    if (!titleJa.trim()) return alert("タイトルは必須です");

    // 0件は許可しない（既存の挙動を崩さないため、最低1件は必要）
    if (editMedia.length === 0)
      return alert("メディアを1つ以上設定してください");

    // 念のため制限チェック
    const imgCount = editMedia.filter((m) => m.type === "image").length;
    const vidCount = editMedia.filter((m) => m.type === "video").length;
    if (imgCount > 5 || vidCount > 1) {
      return alert("メディアの上限を超えています（画像5 / 動画1）");
    }

    setSaving(true);
    try {
      const docRef = doc(db, "siteProjects", siteKey, "items", product.id);
      const storage = getStorage();

      // 既存 remote の path（削除判定用）
      const prevPaths = (docData.mediaPaths ?? []).filter(Boolean);

      // まず final 配列を editMedia の順に作る
      const nextItems: MediaItem[] = [];
      const nextPaths: string[] = [];

      // アップロード対象(local)を順番通りに処理し、progress も順次反映
      const locals = editMedia.filter((m) => m.kind === "local");
      const totalLocal = locals.length;

      let localDone = 0;
      if (totalLocal > 0) setProgress(0);

      for (const m of editMedia) {
        if (m.kind === "remote") {
          nextItems.push({ src: m.src, type: m.type });
          nextPaths.push(m.path ?? ""); // path が無い既存データも許容
          continue;
        }

        // local
        const f = m.file;
        if (!f) continue;

        const isVideo = m.type === "video";
        const ext = isVideo ? extFromMime(f.type) : "jpg";

        const uploadFile = isVideo
          ? f
          : await imageCompression(f, {
              maxWidthOrHeight: 1200,
              maxSizeMB: 0.7,
              useWebWorker: true,
              fileType: "image/jpeg",
              initialQuality: 0.8,
            });

        // path は一意（順番は配列で保持する）
        const path = `projects/public/${siteKey}/${product.id}_${m.type}_${uuid()}.${ext}`;
        const sRef = storageRef(storage, path);

        const task = uploadBytesResumable(sRef, uploadFile, {
          contentType: isVideo ? f.type : "image/jpeg",
        });

        await new Promise<void>((resolve, reject) => {
          task.on(
            "state_changed",
            (s) => {
              const ratio = s.totalBytes
                ? s.bytesTransferred / s.totalBytes
                : 0;
              const overall =
                ((localDone + ratio) / Math.max(1, totalLocal)) * 100;
              setProgress(Math.round(overall));
            },
            reject,
            resolve,
          );
        });

        localDone += 1;

        const url = `${await getDownloadURL(sRef)}?v=${uuid()}`;
        nextItems.push({ src: url, type: m.type });
        nextPaths.push(path);
      }

      setProgress(null);

      // 削除：prevPaths のうち、次に残っていないもの（pathが分かる範囲）
      const keepSet = new Set(nextPaths.filter(Boolean));
      const toDelete = prevPaths.filter((p) => !keepSet.has(p));
      if (toDelete.length > 0) {
        await Promise.all(
          toDelete.map((p) =>
            deleteObject(storageRef(storage, p)).catch(() => {}),
          ),
        );
      }

      // 互換：先頭を mediaURL/mediaType に入れる
      const mediaURL = nextItems[0].src;
      const mediaType: MediaType = nextItems[0].type;

      // 翻訳
      const t = await translateAll(titleJa.trim(), bodyJa.trim());
      const base = { title: titleJa.trim(), body: bodyJa.trim() };

      await updateDoc(docRef, {
        base,
        t,
        title: base.title,
        body: base.body,
        mediaURL,
        mediaType,
        mediaItems: nextItems,
        mediaPaths: nextPaths,
        updatedAt: serverTimestamp(),
      });

      // local objectURL 解放
      revokeLocalUrls(editMedia);

      // state 反映
      setDocData((prev) => ({
        ...(prev as ProductDoc),
        base,
        t,
        title: base.title,
        body: base.body,
        mediaURL,
        mediaType,
        mediaItems: nextItems,
        mediaPaths: nextPaths,
      }));

      // モーダル閉じ
      setShowEdit(false);

      // モーダルを閉じた直後に一覧を「remote化」して持ち直しておく
      setEditMedia(
        nextItems.map((it, i) => ({
          id: `${product.id}_remote_${i}`,
          type: it.type,
          kind: "remote",
          src: it.src,
          path: nextPaths[i] || undefined,
        })),
      );
    } catch (err) {
      console.error(err);
      alert("保存に失敗しました");
      setProgress(null);
    } finally {
      setSaving(false);
    }
  };

  // 削除
  const handleDelete = async () => {
    // ▼ タイトルの null を避ける
    const titleSafe = docData.base?.title ?? docData.title ?? "(無題)";
    if (!confirm(`「${titleSafe}」を削除しますか？`)) return;

    const storage = getStorage();

    // ▼ Firestore 側も siteProjects に統一
    await deleteDoc(
      doc(db, "siteProjects", siteKey, "items", product.id),
    ).catch(() => {});

    try {
      // mediaPaths があればそれを削除（確実）
      if (docData.mediaPaths?.length) {
        await Promise.all(
          docData.mediaPaths
            .filter(Boolean)
            .map((p) => deleteObject(storageRef(storage, p)).catch(() => {})),
        );
      } else {
        // ▼ 旧形式も含めて掃除（product.id. / product.id_）
        const folderRef = storageRef(storage, `projects/public/${siteKey}`);
        const listing = await listAll(folderRef);
        const mine = listing.items.filter(
          (i) =>
            i.name.startsWith(`${product.id}.`) ||
            i.name.startsWith(`${product.id}_`),
        );
        await Promise.all(
          mine.map((item) => deleteObject(item).catch(() => {})),
        );
      }
    } catch {}

    router.back();
  };

  if (!gradient) return null;

  return (
    <main className="min-h-screen flex items-start justify-center p-4 pt-24">
      <BusyOverlay uploadingPercent={progress} saving={saving} />

      {/* 商品カード */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={clsx(
          "border rounded-lg overflow-hidden shadow-xl relative transition-colors duration-200",
          "w-full max-w-md",
          "bg-gradient-to-b",
          "mt-5",
          gradient,
          isDark ? "bg-black/40 text-white" : "bg-white",
        )}
      >
        {isAdmin && (
          <div className="absolute top-2 right-2 z-20 flex gap-1">
            <button
              onClick={openEdit}
              className="px-2 py-1 bg-blue-600 text-white text-md rounded shadow"
              disabled={saving || uploading}
            >
              編集
            </button>
            <button
              onClick={handleDelete}
              className="px-2 py-1 bg-red-600 text-white text-md rounded shadow"
              disabled={saving || uploading}
            >
              削除
            </button>
          </div>
        )}

        {/* ✅ 複数があればスライド表示（なければ従来の単体表示） */}
        <ProductMedia
          src={docData.mediaURL}
          type={(docData.mediaType as MediaType) ?? "image"}
          items={docData.mediaItems}
          alt={display.title || docData.title || "project"}
        />

        <div className="p-4 space-y-2">
          <h1 className="text-lg font-bold whitespace-pre-wrap text-black">
            {display.title}
          </h1>

          {/* 施工実績の本文 */}
          {display.body && (
            <p className="text-sm whitespace-pre-wrap leading-relaxed text-black">
              {display.body}
            </p>
          )}
        </div>
      </motion.div>

      {/* 編集モーダル */}
      {isAdmin && showEdit && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md bg-white rounded-lg p-6 space-y-4">
            <h2 className="text-xl font-bold text-center">商品を編集</h2>

            <input
              placeholder="タイトル（日本語・改行可）"
              value={titleJa}
              onChange={(e) => setTitleJa(e.target.value)}
              className="w-full border px-3 py-2 rounded"
            />

            <textarea
              placeholder="本文（日本語）"
              value={bodyJa}
              onChange={(e) => setBodyJa(e.target.value)}
              className="w-full border px-3 py-2 rounded"
              rows={6}
            />

            {/* AI 本文生成ボタン */}
            <button
              type="button"
              onClick={() => setShowBodyGen(true)}
              className={clsx(
                "w-full mt-2 px-4 py-2 rounded text-white",
                canOpenBodyGen
                  ? "bg-indigo-600 hover:bg-indigo-700"
                  : "bg-gray-400 cursor-not-allowed",
              )}
              disabled={!canOpenBodyGen || saving || uploading}
            >
              AIで本文生成
            </button>

            {/* AI 本文生成モーダル */}
            {showBodyGen && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40"
                onClick={() => !aiGenLoading && setShowBodyGen(false)}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2 }}
                  className="w-full max-w-md mx-4 rounded-2xl shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="rounded-2xl bg-white p-6 space-y-4">
                    <h3 className="text-lg font-bold">AIで本文生成</h3>
                    <p className="text-xs text-gray-500">
                      キーワードを1〜3個入力してください
                    </p>

                    {aiKeywords.map((k, i) => (
                      <input
                        key={i}
                        type="text"
                        value={k}
                        onChange={(e) => {
                          const next = [...aiKeywords];
                          next[i] = e.target.value;
                          setAiKeywords(next);
                        }}
                        placeholder={`キーワード${i + 1}`}
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                        disabled={aiGenLoading}
                      />
                    ))}

                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowBodyGen(false)}
                        className="flex-1 bg-gray-200 rounded-lg py-2"
                        disabled={aiGenLoading}
                      >
                        キャンセル
                      </button>
                      <button
                        onClick={generateBodyWithAI}
                        className={clsx(
                          "flex-1 rounded-lg py-2 text-white",
                          canGenerateBody
                            ? "bg-indigo-600 hover:bg-indigo-700"
                            : "bg-gray-400 cursor-not-allowed",
                        )}
                        disabled={!canGenerateBody || aiGenLoading}
                      >
                        {aiGenLoading ? "生成中…" : "生成する"}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}

            {/* ✅ メディア（画像5 + 動画1 / 削除 / 並べ替え） */}
            <p className="text-xs text-gray-600">
              ※
              画像は最大5枚まで、動画は最大1本まで選択できます（動画は60秒以内）
            </p>

            {editMedia.length > 0 && (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={onDragEndThumb}
              >
                <SortableContext
                  items={editMedia.map((m) => m.id)}
                  strategy={horizontalListSortingStrategy}
                >
                  <div className="flex gap-2 overflow-x-auto py-2">
                    {editMedia.map((m) => (
                      <SortableThumb
                        key={m.id}
                        item={m}
                        onRemove={onRemoveMedia}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}

            <input
              type="file"
              multiple
              accept={[...IMAGE_MIME_TYPES, ...VIDEO_MIME_TYPES].join(",")}
              onChange={(e) => onPickFiles(e.target.files)}
              className="bg-gray-500 text-white w-full h-10 px-3 py-1 rounded"
            />

            <div className="flex gap-2 justify-center">
              <button
                onClick={handleSave}
                disabled={saving || uploading}
                className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
              >
                {saving ? "保存中…" : "更新"}
              </button>
              <button
                onClick={() => {
                  setShowEdit(false);
                  revokeLocalUrls(editMedia);
                }}
                disabled={saving || uploading}
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
