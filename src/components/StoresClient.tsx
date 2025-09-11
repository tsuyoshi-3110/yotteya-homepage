"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Pin, Plus } from "lucide-react";
import clsx from "clsx";
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  onSnapshot,
  CollectionReference,
  DocumentData,
  writeBatch,
  orderBy,
  query,
} from "firebase/firestore";
import {
  getStorage,
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import type { FieldValue } from "firebase/firestore";

import { useThemeGradient } from "@/lib/useThemeGradient";
import { ThemeKey, THEMES } from "@/lib/themes";
import CardSpinner from "./CardSpinner";
import { Button } from "./ui/button";

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
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, useInView } from "framer-motion";

import { SITE_KEY } from "@/lib/atoms/siteKeyAtom";
import { LANGS, type LangKey } from "@/lib/langs";
import { useUILang } from "@/lib/atoms/uiLangAtom";

/* ======================== 定数/型 ======================== */
const STORE_COL = `siteStores/${SITE_KEY}/items`;
const STORAGE_PATH = `stores/public/${SITE_KEY}`;

type Store = {
  id: string;
  name: string;
  address: string;
  description: string;
  imageURL: string;
  originalFileName?: string;
  order?: number;
  createdAt?: any;
  updatedAt?: any;
};

// 多言語フィールド
type Base = { name: string; address: string; description?: string };
type TrStore = {
  lang: LangKey;
  name?: string;
  address?: string;
  description?: string;
};

// ★ 位置情報（保存してリンクは座標優先で生成）
type Geo = { lat: number; lng: number; placeId?: string };

// Firestore ドキュメント（後方互換のため top-level も保持）
type StoreDoc = Store & {
  base?: Base;
  t?: TrStore[];
  geo?: Geo; // ★追加
};

/* ======================== 表示ユーティリティ ======================== */
const norm = (s: string) => (s ?? "").replace(/\r/g, "").trim();
const splitLines = (text: string) =>
  norm(text)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

function pickLocalized(
  s: StoreDoc,
  ui: ReturnType<typeof useUILang>["uiLang"]
): Required<Base> {
  if (ui === "ja") {
    return {
      name: s.base?.name ?? s.name ?? "",
      address: s.base?.address ?? s.address ?? "",
      description: s.base?.description ?? s.description ?? "",
    };
  }
  const hit = s.t?.find((x) => x.lang === ui);
  return {
    name: hit?.name ?? s.base?.name ?? s.name ?? "",
    address: hit?.address ?? s.base?.address ?? s.address ?? "",
    description: hit?.description ?? s.base?.description ?? s.description ?? "",
  };
}

/** 座標優先で Google Maps リンクを生成（座標が無ければ原文住所を使う） */
function buildMapsHref(s: StoreDoc) {
  if (s.geo?.lat && s.geo?.lng) {
    const q = `${s.geo.lat},${s.geo.lng}`;
    const pid = s.geo.placeId
      ? `&query_place_id=${encodeURIComponent(s.geo.placeId)}`
      : "";
    return `https://www.google.com/maps/search/?api=1&query=${q}${pid}`;
    // または `https://www.google.com/maps/dir/?api=1&destination=${q}${pid}` でも可
  }
  const raw = s.base?.address ?? s.address ?? "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    raw
  )}`;
}

/* ======================== 翻訳（保存時に一括） ======================== */
async function translateAllStore(
  nameJa: string,
  addressJa: string,
  descriptionJa: string
): Promise<TrStore[]> {
  const jobs: Promise<TrStore>[] = LANGS.map(async (l) => {
    const [res1, res2] = await Promise.all([
      fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: nameJa,
          body: descriptionJa || " ",
          target: l.key,
        }),
      }),
      addressJa.trim()
        ? fetch("/api/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: addressJa,
              body: " ",
              target: l.key,
            }),
          })
        : Promise.resolve({
            ok: true,
            json: async () => ({ title: "" }),
          } as any),
    ]);

    if (!res1.ok) throw new Error(`translate error(name/desc): ${l.key}`);
    const d1 = (await res1.json()) as { title?: string; body?: string };

    if (!res2.ok) throw new Error(`translate error(address): ${l.key}`);
    const d2 = (await res2.json()) as { title?: string };

    return {
      lang: l.key,
      name: (d1.title ?? "").trim(),
      description: (d1.body ?? "").trim(),
      address: (d2.title ?? "").trim(),
    };
  });

  const settled = await Promise.allSettled(jobs);
  return settled
    .filter(
      (r): r is PromiseFulfilledResult<TrStore> => r.status === "fulfilled"
    )
    .map((r) => r.value);
}

/* ======================== 本体 ======================== */
export default function StoresClient() {
  const { uiLang } = useUILang();

  const [stores, setStores] = useState<StoreDoc[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editingStore, setEditingStore] = useState<StoreDoc | null>(null);

  // 入力（原文＝日本語）
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");

  // 画像
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const uploading = progress !== null;
  const [submitFlag, setSubmitFlag] = useState(false);

  // AI 紹介文モーダル
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiKeyword, setAiKeyword] = useState("");
  const [aiFeature, setAiFeature] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const gradient = useThemeGradient();
  const isDark = useMemo(() => {
    const darkThemes: ThemeKey[] = ["brandG", "brandH", "brandI"];
    if (!gradient) return false;
    return darkThemes.some((k) => gradient === THEMES[k]);
  }, [gradient]);

  const colRef: CollectionReference<DocumentData> = useMemo(
    () => collection(db, STORE_COL),
    []
  );

  /* -------- DnD -------- */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = stores.findIndex((s) => s.id === active.id);
    const newIndex = stores.findIndex((s) => s.id === over.id);
    const newList = arrayMove(stores, oldIndex, newIndex);
    setStores(newList);
    const batch = writeBatch(db);
    newList.forEach((s, i) =>
      batch.update(doc(db, STORE_COL, s.id), { order: i })
    );
    await batch.commit();
  };

  /* -------- Auth/購読 -------- */
  useEffect(() => onAuthStateChanged(auth, (u) => setIsAdmin(!!u)), []);

  useEffect(() => {
    const qy = query(colRef, orderBy("order", "asc"));
    const unsub = onSnapshot(qy, (snap) => {
      const docs: StoreDoc[] = snap.docs.map((d) => {
        const data = d.data() as any;

        const base: Base = data.base ?? {
          name: data.name ?? "",
          address: data.address ?? "",
          description: data.description ?? "",
        };

        const t: TrStore[] = Array.isArray(data.t)
          ? data.t.map((x: any) => ({
              lang: x.lang as LangKey,
              name: (x.name ?? "").trim(),
              address: (x.address ?? "").trim(),
              description: (x.description ?? "").trim(),
            }))
          : [];

        const geo: Geo | undefined =
          typeof data.geo?.lat === "number" && typeof data.geo?.lng === "number"
            ? {
                lat: data.geo.lat,
                lng: data.geo.lng,
                ...(data.geo.placeId ? { placeId: data.geo.placeId } : {}),
              }
            : undefined;

        return {
          id: d.id,
          name: data.name ?? base.name,
          address: data.address ?? base.address,
          description: data.description ?? base.description ?? "",
          imageURL: data.imageURL ?? "",
          originalFileName: data.originalFileName,
          order: data.order ?? 9999,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          base,
          t,
          ...(geo ? { geo } : {}),
        } as StoreDoc;
      });
      docs.sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
      setStores(docs);
    });
    return () => unsub();
  }, [colRef]);

  /* -------- CRUD -------- */
  const openAdd = () => {
    if (uploading || submitFlag) return;
    setEditingStore(null);
    setName("");
    setAddress("");
    setDescription("");
    setFile(null);
    setFormMode("add");
  };

  const openEdit = (s: StoreDoc) => {
    if (uploading || submitFlag) return;
    setEditingStore(s);
    setName(s.base?.name ?? s.name ?? "");
    setAddress(s.base?.address ?? s.address ?? "");
    setDescription(s.base?.description ?? s.description ?? "");
    setFile(null);
    setFormMode("edit");
  };

  const closeForm = () => {
    if (uploading || submitFlag) return;
    setFormMode(null);
  };

  const saveStore = async () => {
    if (uploading || submitFlag) return;
    if (!name.trim() || !address.trim()) {
      return alert("店舗名と住所は必須です");
    }
    try {
      setSubmitFlag(true);

      const isEdit = formMode === "edit" && !!editingStore;
      const docRef = isEdit ? doc(colRef, editingStore!.id) : doc(colRef);
      const id = docRef.id;

      // 画像アップロード
      let imageURL = isEdit ? editingStore!.imageURL || "" : "";
      let originalFileName = file?.name ?? editingStore?.originalFileName ?? "";

      if (file) {
        const ext = (
          file.name.match(/\.([a-zA-Z0-9]+)$/)?.[1] || "jpg"
        ).toLowerCase();
        const allowedExts = ["jpg", "jpeg", "png", "webp"];
        if (!allowedExts.includes(ext)) {
          alert("サポートされていない画像形式です（jpg/jpeg/png/webp）");
          setSubmitFlag(false);
          return;
        }

        const sref = storageRef(getStorage(), `${STORAGE_PATH}/${id}.${ext}`);
        const task = uploadBytesResumable(sref, file, {
          contentType: file.type,
        });
        setProgress(0);

        await new Promise<void>((resolve, reject) => {
          task.on(
            "state_changed",
            (s) =>
              setProgress(
                Math.round((s.bytesTransferred / s.totalBytes) * 100)
              ),
            (e) => {
              console.error(e);
              alert("画像アップロードに失敗しました");
              setProgress(null);
              reject(e);
            },
            async () => {
              try {
                imageURL = await getDownloadURL(task.snapshot.ref);
                imageURL = imageURL.replace(
                  "crepe-shop-homepage.appspot.com",
                  "crepe-shop-homepage.firebasestorage.app"
                );
                setProgress(null);

                if (isEdit && editingStore) {
                  const oldExt = editingStore.imageURL.match(
                    /\.([a-zA-Z0-9]+)(\?|$)/
                  )?.[1];
                  if (oldExt && oldExt.toLowerCase() !== ext) {
                    await deleteObject(
                      storageRef(
                        getStorage(),
                        `${STORAGE_PATH}/${id}.${oldExt}`
                      )
                    ).catch(() => {});
                  }
                }
                resolve();
              } catch (err) {
                reject(err);
              }
            }
          );
        });

        originalFileName = file.name;
      }

      // 全言語翻訳（保存前に一括）
      const t = await translateAllStore(
        name.trim(),
        address.trim(),
        (description ?? "").trim()
      );

      // Firestore へ保存（互換用 top-level も保持）
      const base: Base = {
        name: name.trim(),
        address: address.trim(),
        ...(description.trim() && { description: description.trim() }),
      };

      // ★ ジオコーディング：新規 or 住所変更時に実行。失敗時は既存 geo を維持
      let geo: Geo | undefined = undefined;
      const prevAddr =
        editingStore?.base?.address ?? editingStore?.address ?? "";
      const needsGeocode = !isEdit || prevAddr !== base.address;

      if (needsGeocode) {
        try {
          const res = await fetch("/api/geocode", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ address: base.address }),
          });
          if (res.ok) {
            const g = (await res.json()) as {
              lat?: number;
              lng?: number;
              placeId?: string;
            };
            if (typeof g.lat === "number" && typeof g.lng === "number") {
              geo = {
                lat: g.lat,
                lng: g.lng,
                ...(g.placeId ? { placeId: g.placeId } : {}),
              };
            }
          }
        } catch (e) {
          console.warn("ジオコーディング失敗:", e);
        }
      } else if (isEdit && editingStore?.geo) {
        geo = editingStore.geo; // 住所に変更がない場合は既存を維持
      }

      const payload: {
        base: Base;
        t: TrStore[];
        name: string;
        address: string;
        description?: string;
        imageURL: string;
        updatedAt: FieldValue;
        originalFileName?: string;
        geo?: Geo;
      } = {
        base,
        t,
        name: base.name,
        address: base.address,
        ...(base.description && { description: base.description }),
        imageURL,
        updatedAt: serverTimestamp(),
        ...(originalFileName && { originalFileName }),
        ...(geo ? { geo } : {}),
      };

      if (isEdit) {
        await updateDoc(docRef, payload);
      } else {
        const nextOrder = (stores.at(-1)?.order ?? stores.length - 1) + 1;
        await setDoc(docRef, {
          ...payload,
          createdAt: serverTimestamp(),
          order: nextOrder,
        });
      }

      closeForm();
    } catch (e) {
      console.error(e);
      alert("保存に失敗しました");
      setProgress(null);
    } finally {
      setSubmitFlag(false);
    }
  };

  const removeStore = async (s: StoreDoc) => {
    if (!confirm(`「${s.name}」を削除しますか？`)) return;
    try {
      await deleteDoc(doc(colRef, s.id));
      if (s.imageURL) {
        const ext = s.imageURL
          .match(/\.([a-zA-Z0-9]+)(\?|$)/)?.[1]
          ?.toLowerCase();
        const allowedExts = ["jpg", "jpeg", "png", "webp"];
        if (ext && allowedExts.includes(ext)) {
          await deleteObject(
            storageRef(getStorage(), `${STORAGE_PATH}/${s.id}.${ext}`)
          ).catch((err) => console.warn("画像の削除に失敗しました:", err));
        }
      }
    } catch (err) {
      console.error("削除に失敗しました:", err);
      alert("削除中にエラーが発生しました");
    }
  };

  if (!gradient) return <CardSpinner />;

  return (
    <main className="max-w-5xl mx-auto p-4 mt-20">
      {/* 並べ替え */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={stores.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {stores.map((s) => {
              const loc = pickLocalized(s, uiLang);
              return (
                <SortableStoreItem key={s.id} store={s}>
                  {({ attributes, listeners, isDragging }) => (
                    <StoreCard
                      store={s}
                      locName={loc.name}
                      locAddress={loc.address}
                      locDescription={loc.description ?? ""}
                      isAdmin={isAdmin}
                      isDragging={isDragging}
                      isDark={isDark}
                      gradient={gradient!}
                      listeners={listeners}
                      attributes={attributes}
                      onEdit={openEdit}
                      onRemove={removeStore}
                    />
                  )}
                </SortableStoreItem>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {/* 新規追加 */}
      {isAdmin && formMode === null && (
        <button
          onClick={openAdd}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 cursor-pointer rounded-full bg-blue-500 text-white flex items-center justify-center shadow-lg hover:bg-pink-700 active:scale-95 transition disabled:opacity-50"
        >
          <Plus size={28} />
        </button>
      )}

      {/* フォームモーダル（原文=日本語のみ編集） */}
      {isAdmin && formMode && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 w-full max-w-md space-y-4">
            <h2 className="text-xl font-bold text-center">
              {formMode === "edit" ? "店舗を編集" : "店舗を追加"}
            </h2>

            {/* 店名（原文、日本語、改行可） */}
            <textarea
              placeholder="店舗名（日本語・改行可）"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border px-3 py-2 rounded whitespace-pre-wrap"
              rows={2}
              disabled={uploading || submitFlag}
            />

            {/* 住所（原文、日本語、改行可） */}
            <textarea
              placeholder="住所（日本語・改行可）"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full border px-3 py-2 rounded whitespace-pre-wrap"
              rows={2}
              disabled={uploading || submitFlag}
            />

            {/* 紹介文（任意） */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                （任意）紹介文（日本語）
              </label>
              <textarea
                placeholder="紹介文（日本語）"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full border px-3 py-2 rounded whitespace-pre-wrap"
                rows={3}
                disabled={uploading || submitFlag}
              />
            </div>

            {/* AIで紹介文を生成（モーダルを開く） */}
            <button
              onClick={() => {
                if (!name.trim() || !address.trim()) {
                  alert("店舗名と住所を入力してください");
                  return;
                }
                setShowAIModal(true);
              }}
              disabled={uploading || submitFlag || aiLoading}
              className="w-full mt-2 px-4 py-2 bg-purple-600 text-white rounded disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {aiLoading ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5 text-white"
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
                  <span>生成中…</span>
                </>
              ) : (
                "AIで紹介文を生成"
              )}
            </button>

            {/* （任意）画像 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                （任意）画像
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="w-full h-10 bg-gray-400 text-white rounded-md file:text-white file:px-4 file:py-1 file:border-0 file:cursor-pointer"
                disabled={uploading || submitFlag}
              />
            </div>

            {/* 進捗 */}
            {uploading && (
              <div className="space-y-2">
                <p className="text-sm text-gray-500">
                  アップロード中… {progress}%
                </p>
                <div className="w-full h-2 bg-gray-300 rounded">
                  <div
                    className="h-full bg-green-500 rounded transition-all"
                    style={{ width: `${progress ?? 0}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-center gap-2">
              <Button
                onClick={saveStore}
                disabled={submitFlag || uploading}
                className="px-4 py-2 bg-green-600 text-white rounded"
              >
                {submitFlag ? "保存中..." : "保存"}
              </Button>
              <button
                onClick={closeForm}
                disabled={submitFlag || uploading}
                className="px-4 py-2 bg-gray-500 text-white rounded"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AIモーダル（成功時に自動で閉じる） */}
      {showAIModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm space-y-4">
            <h3 className="text-lg font-semibold text-center">
              紹介文をAIで生成
            </h3>

            <input
              type="text"
              placeholder="何の店舗か？（例: クレープ屋）"
              value={aiKeyword}
              onChange={(e) => setAiKeyword(e.target.value)}
              className="w-full border px-3 py-2 rounded"
              disabled={aiLoading}
            />
            <input
              type="text"
              placeholder="イチオシは？（例: チョコバナナ）"
              value={aiFeature}
              onChange={(e) => setAiFeature(e.target.value)}
              className="w-full border px-3 py-2 rounded"
              disabled={aiLoading}
            />

            <div className="space-y-2">
              <Button
                className="bg-indigo-600 w-full disabled:opacity-50"
                disabled={!aiKeyword || !aiFeature || aiLoading}
                onClick={async () => {
                  setAiLoading(true);
                  try {
                    const res = await fetch("/api/generate-store-description", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        name,
                        address,
                        keyword: aiKeyword,
                        feature: aiFeature,
                      }),
                    });
                    const data = await res.json();
                    if (!res.ok || !data?.description)
                      throw new Error(data?.error || "生成に失敗");
                    const out = String(data.description).trim();
                    setDescription((prev) =>
                      prev?.trim() ? `${prev}\n\n${out}` : out
                    );
                    // 生成成功 → 自動でモーダルを閉じる
                    setShowAIModal(false);
                    setAiKeyword("");
                    setAiFeature("");
                  } catch (err) {
                    alert("エラーが発生しました");
                    console.error(err);
                  } finally {
                    setAiLoading(false);
                  }
                }}
              >
                {aiLoading ? "生成中..." : "生成する"}
              </Button>

              <Button
                className="bg-gray-300 w-full"
                variant="outline"
                onClick={() => {
                  setShowAIModal(false);
                  setAiKeyword("");
                  setAiFeature("");
                }}
              >
                閉じる
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/* ======================== Sortable item ======================== */
function SortableStoreItem({
  store,
  children,
}: {
  store: StoreDoc;
  children: (props: {
    attributes: any;
    listeners: any;
    isDragging: boolean;
  }) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: store.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style}>
      {children({ attributes, listeners, isDragging })}
    </div>
  );
}

/* ======================== カード ======================== */
interface StoreCardProps {
  store: StoreDoc;
  locName: string;
  locAddress: string;
  locDescription: string;
  isAdmin: boolean;
  isDragging: boolean;
  isDark: boolean;
  gradient: string;
  listeners: any;
  attributes: any;
  onEdit: (store: StoreDoc) => void;
  onRemove: (store: StoreDoc) => void;
}

function StoreCard({
  store: s,
  locName,
  locAddress,
  locDescription,
  isAdmin,
  isDragging,
  isDark,
  gradient,
  listeners,
  attributes,
  onEdit,
  onRemove,
}: StoreCardProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -150px 0px" });

  const addrLines = splitLines(locAddress);
  const primaryAddr = addrLines[0] ?? "";

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={clsx(
        "rounded-lg shadow relative transition-colors overflow-visible mt-6",
        "bg-gradient-to-b",
        gradient,
        isDragging
          ? "bg-yellow-100"
          : isDark
          ? "bg-black/40 text-white"
          : "bg-white"
      )}
    >
      {auth.currentUser !== null && (
        <div
          {...attributes}
          {...listeners}
          onTouchStart={(e) => e.preventDefault()}
          className="absolute -top-5 left-1/2 -translate-x-1/2 z-30 cursor-grab active:cursor-grabbing touch-none select-none"
        >
          <div className="w-10 h-10 rounded-full bg-white/90 text-gray-800 flex items-center justify-center shadow-md ring-1 ring-black/10 backdrop-blur">
            <Pin className="w-5 h-5" />
          </div>
        </div>
      )}

      {s.imageURL && (
        <div className="relative w-full aspect-[1/1]">
          <Image
            src={s.imageURL}
            alt={locName || s.name}
            fill
            className="object-cover rounded-t-lg"
            unoptimized
          />
        </div>
      )}

      <div className={clsx("p-4 space-y-2", isDark && "text-white")}>
        <h2 className="text-xl font-semibold whitespace-pre-wrap">{locName}</h2>

        <div className="text-sm">
          {primaryAddr && (
            <a
              href={buildMapsHref(s)} // ★ 座標優先リンク
              target="_blank"
              rel="noopener noreferrer"
              className={clsx(
                "underline",
                isDark
                  ? "text-blue-300 hover:text-blue-200"
                  : "text-blue-700 hover:text-blue-900"
              )}
            >
              {primaryAddr}
            </a>
          )}
          {addrLines.slice(1).map((ln, i) => (
            <div key={i} className="whitespace-pre-wrap">
              {ln}
            </div>
          ))}
        </div>

        {locDescription && (
          <p className="text-sm whitespace-pre-wrap">{locDescription}</p>
        )}
      </div>

      {isAdmin && (
        <div className="absolute top-2 right-2 flex gap-2">
          <button
            className="px-2 py-1 bg-blue-600 text-white rounded text-sm"
            onClick={() => onEdit(s)}
          >
            編集
          </button>
          <button
            className="px-2 py-1 bg-red-600 text-white rounded text-sm"
            onClick={() => onRemove(s)}
          >
            削除
          </button>
        </div>
      )}
    </motion.div>
  );
}
