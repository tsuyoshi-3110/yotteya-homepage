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
} from "firebase/firestore";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

/* ─────────── サイトごとの固定キー ─────────── */
const SITE_KEY = "yotteya";

/* Firestore 型 */
type Product = {
  id: string;
  title: string;
  body: string;
  price: number;
  imageURL: string;
};

export default function ProductsPage() {
  /* ---------------- state ---------------- */
  const [list, setList] = useState<Product[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  /* 管理フォーム制御 */
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null); // null = 非表示
  const [editing, setEditing] = useState<Product | null>(null);

  /* フォーム入力 */
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [price, setPrice] = useState<number | "">("");

  /* Firestore コレクション参照（固定） */
  const colRef: CollectionReference = useMemo(
    () => collection(db, "siteProducts", SITE_KEY, "items"),
    []
  );

  /* -------- 権限判定 -------- */
  useEffect(() => onAuthStateChanged(auth, (u) => setIsAdmin(!!u)), []);

  /* -------- リアルタイム取得 -------- */
  useEffect(() => {
    const unsub = onSnapshot(colRef, (snap) =>
      setList(
        snap.docs.map(
          (d) =>
            ({
              id: d.id,
              price: 0,
              ...d.data(),
            } as Product)
        )
      )
    );
    return () => unsub();
  }, [colRef]);

  const getErrorMessage = (e: unknown): string =>
    e instanceof Error ? e.message : String(e);

  /* -------- 保存 -------- */
  const saveProduct = async () => {
    try {
      if (!title.trim()) return alert("タイトル必須");
      if (!file) return alert("画像を選択してください");
      if (price === "" || isNaN(+price) || !file)
        return alert("価格を入力してください");

      const id = editing?.id ?? uuid();
      let imageURL = editing?.imageURL ?? "";

      /* 圧縮 & アップロード */
      if (file) {
        const compressed = await imageCompression(file, {
          maxWidthOrHeight: 1200,
          maxSizeMB: 0.7,
          fileType: "image/jpeg",
          initialQuality: 0.8,
        });
        const imgRef = ref(
          getStorage(),
          `products/public/${SITE_KEY}/${id}.jpg`
        );
        await uploadBytes(imgRef, compressed, { contentType: "image/jpeg" });
        imageURL = await getDownloadURL(imgRef);
      }

      const payload = { title, body, price: Number(price), imageURL };

      if (formMode === "edit" && editing) {
        await updateDoc(doc(colRef, id), payload);
      } else {
        await addDoc(colRef, { ...payload, createdAt: serverTimestamp() });
      }
      closeForm();
    } catch (err: unknown) {
      // ← any を unknown に
      console.error("saveProduct error:", err);
      alert(`保存に失敗しました: ${getErrorMessage(err)}`);
    }
  };

  /* -------- 削除 -------- */
  const remove = async (p: Product) => {
    if (!confirm(`「${p.title}」を削除しますか？`)) return;
    await deleteDoc(doc(colRef, p.id));
    if (p.imageURL) {
      await deleteObject(
        ref(getStorage(), `products/public/${SITE_KEY}/${p.id}.jpg`)
      ).catch(() => {});
    }
  };

  /* -------- フォーム制御 -------- */
  const openAdd = () => {
    resetFields();
    setFormMode("add");
  };
  const openEdit = (p: Product) => {
    setEditing(p);
    setTitle(p.title);
    setBody(p.body);
    setPrice(p.price);
    setFile(null);
    setFormMode("edit");
  };
  const closeForm = () => {
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

  /* ---------------- view ---------------- */
  return (
    <main className="max-w-5xl mx-auto p-4 mt-16">
      <h1 className="text-3xl font-bold mb-6 text-center">商品一覧</h1>

      {/* カード一覧 */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((p) => (
          <div
            key={p.id}
            className="border rounded-lg overflow-hidden shadow relative"
          >
            {p.imageURL && (
              <div className="relative w-full aspect-square">
                <Image
                  src={p.imageURL}
                  alt={p.title}
                  fill
                  className="object-cover"
                  sizes="(min-width:1024px) 320px, (min-width:640px) 45vw, 90vw"
                />
              </div>
            )}
            <div className="p-4 space-y-2">
              <h2 className="text-lg font-bold truncate">{p.title}</h2>
              <p className="text-pink-700 font-semibold">
                ¥{p.price.toLocaleString()}
              </p>
              <p className="text-sm whitespace-pre-wrap line-clamp-3">
                {p.body}
              </p>

              {isAdmin && (
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => openEdit(p)}
                    className="px-3 py-1 bg-blue-600 text-white rounded"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => remove(p)}
                    className="px-3 py-1 bg-red-600 text-white rounded"
                  >
                    削除
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 右下フローティング新規ボタン */}
      {isAdmin && formMode === null && (
        <button
          onClick={openAdd}
          aria-label="新規追加"
          className="fixed bottom-6 right-6 z-20 w-14 h-14 rounded-full bg-pink-600 text-white
                     flex items-center justify-center shadow-lg hover:bg-pink-700 active:scale-95 transition"
        >
          <Plus size={28} />
        </button>
      )}

      {/* 管理フォーム (モーダル) */}
      {isAdmin && formMode && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 ">
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
            />
            <input
              type="number" // 数値入力
              inputMode="numeric" // モバイルで数値キーボードを表示
              step="1" // 1円単位（小数を許可するなら 0.01 など）
              min={0} // 0円以上
              placeholder="価格 (円)"
              value={price}
              onChange={(e) =>
                setPrice(e.target.value === "" ? "" : Number(e.target.value))
              }
              className="w-full border px-3 py-2 rounded"
            />
            <textarea
              placeholder="紹介文"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full border px-3 py-2 rounded"
              rows={4}
            />
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="
                    bg-gray-500 text-white w-full
                    h-10 px-3 py-1 text-sm
                    md:h-12 md:px-4 md:py-2 md:text-base
                    rounded
                  "
            />

            <div className="flex gap-2 justify-center">
              <button
                onClick={saveProduct}
                className="px-4 py-2 bg-green-600 text-white rounded"
              >
                {formMode === "edit" ? "更新" : "追加"}
              </button>
              <button
                onClick={closeForm}
                className="px-4 py-2 bg-gray-500 text-white rounded"
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
