/* src/app/(routes)/products/page.tsx */
"use client";

import { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import { Plus } from "lucide-react";
import { v4 as uuid } from "uuid";
import imageCompression from "browser-image-compression";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  onSnapshot,
  CollectionReference,
  DocumentData,
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

/* ───────── サイトごとの固定キー ───────── */
const SITE_KEY = "yotteya";

/* 型定義 */
type MediaType = "image" | "video";
type Product = {
  id: string;
  title: string;
  body: string;
  price: number;
  mediaURL: string;
  mediaType: MediaType;
};

export default function ProductsPage() {
  /* ──────────── state ──────────── */
  const [list, setList] = useState<Product[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  /* フォーム関連 */
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [price, setPrice] = useState<number | "">("");

  /* アップロード進捗（null: 非アップロード中） */
  const [progress, setProgress] = useState<number | null>(null);
  const uploading = progress !== null;

  /* メディアのロード完了 ID を覚える集合 */
  const [loadedIds, setLoadedIds] = useState<Set<string>>(new Set());

  /* ──────────── Firestore 参照 ──────────── */
  const colRef: CollectionReference = useMemo(
    () => collection(db, "siteProducts", SITE_KEY, "items"),
    []
  );

  /* ──────────── Collator（五十音ソート用） ──────────── */
  const jaCollator = useMemo(
    () => new Intl.Collator("ja-JP", { numeric: true, sensitivity: "base" }),
    []
  );

  /* 権限判定 */
  useEffect(() => onAuthStateChanged(auth, (u) => setIsAdmin(!!u)), []);

  /* リアルタイム取得 */
  useEffect(() => {
    const unsub = onSnapshot(colRef, (snap) => {
      const rows: Product[] = snap.docs.map((d) => {
        const data = d.data() as DocumentData;
        return {
          id: d.id,
          title: data.title,
          body: data.body,
          price: data.price ?? 0,
          mediaURL: data.mediaURL ?? data.imageURL ?? "",
          mediaType: (data.mediaType ?? "image") as MediaType,
        };
      });
      /* ⽇本語辞書順（数字も考慮）で並べ替え */
      rows.sort((a, b) => jaCollator.compare(a.title, b.title));
      setList(rows);
    });
    return () => unsub();
  }, [colRef, jaCollator]);

  /* ──────────── CRUD ──────────── */
  const saveProduct = async () => {
    if (uploading) return;
    if (!title.trim()) return alert("タイトル必須");
    if (price === "" || isNaN(+price)) return alert("価格を入力してください");
    if (formMode === "add" && !file) return alert("メディアを選択してください");

    try {
      const id = editing?.id ?? uuid();
      let mediaURL = editing?.mediaURL ?? "";
      let mediaType: MediaType = editing?.mediaType ?? "image";

      /* ---------- メディアアップロード ---------- */
      if (file) {
        const isVideo = file.type.startsWith("video/");
        mediaType = isVideo ? "video" : "image";
        const ext = isVideo ? "mp4" : "jpg";

        const uploadFile = isVideo
          ? file
          : await imageCompression(file, {
              maxWidthOrHeight: 1200,
              maxSizeMB: 0.7,
              fileType: "image/jpeg",
              initialQuality: 0.8,
            });

        const storageRef = ref(
          getStorage(),
          `products/public/${SITE_KEY}/${id}.${ext}`
        );
        const task = uploadBytesResumable(storageRef, uploadFile, {
          contentType: file.type,
        });

        /* 進捗をトラッキング */
        setProgress(0);
        task.on("state_changed", (s) =>
          setProgress(Math.round((s.bytesTransferred / s.totalBytes) * 100))
        );
        await task;
        mediaURL = await getDownloadURL(storageRef);
        setProgress(null);

        /* 画像→動画 or 動画→画像 の更新時に元ファイルが残らないよう削除 */
        if (formMode === "edit" && editing) {
          const oldExt = editing.mediaType === "video" ? "mp4" : "jpg";
          if (oldExt !== ext) {
            await deleteObject(
              ref(getStorage(), `products/public/${SITE_KEY}/${id}.${oldExt}`)
            ).catch(() => {});
          }
        }
      }

      /* ---------- Firestore 更新 ---------- */
      const payload = {
        title,
        body,
        price: Number(price),
        mediaURL,
        mediaType,
      };

      if (formMode === "edit" && editing) {
        await updateDoc(doc(colRef, id), payload);
      } else {
        await addDoc(colRef, { ...payload, createdAt: serverTimestamp() });
      }
      closeForm();
    } catch (e) {
      console.error(e);
      alert("保存に失敗しました");
      setProgress(null);
    }
  };

  const remove = async (p: Product) => {
    if (uploading) return;
    if (!confirm(`「${p.title}」を削除しますか？`)) return;

    await deleteDoc(doc(colRef, p.id));
    if (p.mediaURL) {
      const ext = p.mediaType === "video" ? "mp4" : "jpg";
      await deleteObject(
        ref(getStorage(), `products/public/${SITE_KEY}/${p.id}.${ext}`)
      ).catch(() => {});
    }
  };

  /* ──────────── フォーム制御 ──────────── */
  const openAdd = () => {
    if (uploading) return;
    resetFields();
    setFormMode("add");
  };
  const openEdit = (p: Product) => {
    if (uploading) return;
    setEditing(p);
    setTitle(p.title);
    setBody(p.body);
    setPrice(p.price);
    setFile(null);
    setFormMode("edit");
  };
  const closeForm = () => {
    if (uploading) return;
    resetFields();
    setFormMode(null);
  };
  const resetFields = () => {
    setEditing(null);
    setTitle("");
    setBody("");
    setPrice("");
    setFile(null);
  };

  /* ──────────── UI ──────────── */
  return (
    <main className="max-w-5xl mx-auto p-4 mt-20">
      {/* === アップロード進捗 === */}
      {uploading && (
        <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-black/60 gap-4">
          <p className="text-white">アップロード中… {progress}%</p>
          <div className="w-64 h-2 bg-gray-700 rounded">
            <div
              className="h-full bg-green-500 rounded transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* === 商品カード === */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((p) => {
          const isLoaded = loadedIds.has(p.id);

          return (
            <div
              key={p.id}
              className="border rounded-lg overflow-hidden shadow bg-white relative bg-gradient-to-b from-[#fe01be] to-[#fadb9f]"
            >
              {/* ⭐ 編集削除ボタン：画像右上に絶対配置 */}
              {isAdmin && (
                <div className="absolute top-2 right-2 z-20 flex gap-2">
                  <button
                    onClick={() => openEdit(p)}
                    disabled={uploading}
                    className="px-2 py-1 bg-blue-600 text-white text-md rounded shadow disabled:opacity-50"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => remove(p)}
                    disabled={uploading}
                    className="px-2 py-1 bg-red-600 text-white text-md rounded shadow disabled:opacity-50"
                  >
                    削除
                  </button>
                </div>
              )}

              {/* ⭐ スピナー（未ロード時のみ） */}
              {!isLoaded && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/10">
                  <svg
                    className="w-8 h-8 animate-spin text-pink-600"
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
                </div>
              )}

              {/* メディア本体 */}
              {p.mediaType === "image" ? (
                <div className="relative w-full aspect-square">
                  <Image
                    src={p.mediaURL}
                    alt={p.title}
                    fill
                    className="object-cover"
                    sizes="(min-width:1024px) 320px, (min-width:640px) 45vw, 90vw"
                    onLoad={() =>
                      setLoadedIds((prev) => new Set(prev).add(p.id))
                    }
                  />
                </div>
              ) : (
                <video
                  src={p.mediaURL}
                  muted
                  playsInline
                  autoPlay
                  loop
                  preload="auto"
                  className="w-full aspect-square object-cover pointer-events-none"
                  onLoadedData={() =>
                    setLoadedIds((prev) => new Set(prev).add(p.id))
                  }
                />
              )}

              {/* テキスト部分 */}
              <div className="p-4 space-y-2">
                <h2 className="text-lg font-bold">{p.title}</h2>
                <p className="text-pink-700 font-semibold">
                  ¥{p.price.toLocaleString()}
                </p>
                <p className="text-sm whitespace-pre-wrap">{p.body}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* === 新規追加ボタン === */}
      {isAdmin && formMode === null && (
        <button
          onClick={openAdd}
          aria-label="新規追加"
          disabled={uploading}
          className="fixed bottom-6 right-6 z-20 w-14 h-14 rounded-full bg-pink-600 text-white
                   flex items-center justify-center shadow-lg hover:bg-pink-700
                   active:scale-95 transition disabled:opacity-50"
        >
          <Plus size={28} />
        </button>
      )}

      {/* === 管理フォーム (モーダル) === */}
      {isAdmin && formMode && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md bg-white rounded-lg p-6 space-y-4">
            <h2 className="text-xl font-bold text-center">
              {formMode === "edit" ? "商品を編集" : "新規商品追加"}
            </h2>

            <input
              type="text"
              placeholder="タイトル"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border px-3 py-2 rounded"
              disabled={uploading}
            />
            <input
              type="number"
              min={0}
              inputMode="numeric"
              placeholder="価格 (円)"
              value={price}
              onChange={(e) =>
                setPrice(e.target.value === "" ? "" : Number(e.target.value))
              }
              className="w-full border px-3 py-2 rounded"
              disabled={uploading}
            />
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
              accept="image/*,video/mp4"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="bg-gray-500 text-white w-full h-10 px-3 py-1 rounded"
              disabled={uploading}
            />

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
