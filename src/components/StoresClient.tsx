"use client";

import { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import { Plus } from "lucide-react";
import { v4 as uuid } from "uuid";
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

const SITE_KEY = "yotteya";
const STORE_COL = `siteStores/${SITE_KEY}/items`;
const STORAGE_PATH = `stores/public/${SITE_KEY}`;

type Store = {
  id: string;
  name: string;
  address: string;
  description: string;
  imageURL: string;
};

export default function StoresClient() {
  const [stores, setStores] = useState<Store[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const uploading = progress !== null;

  const colRef: CollectionReference = useMemo(
    () => collection(db, STORE_COL),
    []
  );

  useEffect(() => onAuthStateChanged(auth, (u) => setIsAdmin(!!u)), []);

  useEffect(() => {
    const unsub = onSnapshot(
      colRef,
      (snap) => {
        setStores(
          snap.docs.map((d) => {
            const data = d.data() as DocumentData;
            return {
              id: d.id,
              name: data.name,
              address: data.address,
              description: data.description ?? "",
              imageURL: data.imageURL,
            };
          })
        );
      },
      console.error
    );
    return () => unsub();
  }, [colRef]);

  const openAdd = () => {
    setEditingStore(null);
    setName("");
    setAddress("");
    setDescription("");
    setFile(null);
    setFormMode("add");
  };

  const openEdit = (s: Store) => {
    setEditingStore(s);
    setName(s.name);
    setAddress(s.address);
    setDescription(s.description);
    setFile(null);
    setFormMode("edit");
  };

  const closeForm = () => {
    if (uploading) return;
    setFormMode(null);
  };

  const saveStore = async () => {
    if (!name.trim() || !address.trim() || (!file && formMode === "add")) {
      return alert("名前・住所・画像をすべて入力してください");
    }

    try {
      const id = editingStore?.id ?? uuid();
      let imageURL = editingStore?.imageURL ?? "";

      if (file) {
        const ext = file.type.startsWith("image/") ? "jpg" : "";
        const storageRef = ref(getStorage(), `${STORAGE_PATH}/${id}.${ext}`);
        const task = uploadBytesResumable(storageRef, file, {
          contentType: file.type,
        });
        setProgress(0);
        task.on(
          "state_changed",
          (s) =>
            setProgress(Math.round((s.bytesTransferred / s.totalBytes) * 100)),
          (e) => {
            console.error(e);
            alert("画像アップロードに失敗しました");
            setProgress(null);
          },
          async () => {
            imageURL = await getDownloadURL(task.snapshot.ref);
            setProgress(null);

            if (formMode === "edit" && editingStore) {
              const oldExt = editingStore.imageURL.endsWith(".jpg")
                ? "jpg"
                : "";
              if (oldExt && oldExt !== ext) {
                await deleteObject(
                  ref(getStorage(), `${STORAGE_PATH}/${id}.${oldExt}`)
                ).catch(() => {});
              }
            }

            upsertFirestore(id, imageURL);
          }
        );
      } else {
        await upsertFirestore(id, imageURL);
      }
    } catch (e) {
      console.error(e);
      alert("保存に失敗しました");
      setProgress(null);
    }
  };

  const upsertFirestore = async (id: string, imageURL: string) => {
    const payload = {
      name,
      address,
      description,
      imageURL,
      updatedAt: serverTimestamp(),
    };
    if (formMode === "edit" && editingStore) {
      await updateDoc(doc(colRef, id), payload);
    } else {
      await addDoc(colRef, { ...payload, createdAt: serverTimestamp() });
    }
    closeForm();
  };

  const removeStore = async (s: Store) => {
    if (!confirm(`「${s.name}」を削除しますか？`)) return;
    await deleteDoc(doc(colRef, s.id));
    const ext = s.imageURL.endsWith(".jpg") ? "jpg" : "";
    if (ext) {
      await deleteObject(
        ref(getStorage(), `${STORAGE_PATH}/${s.id}.${ext}`)
      ).catch(() => {});
    }
  };

  return (
    <main className="max-w-5xl mx-auto p-4 mt-20">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {stores.map((s) => (
          <div
            key={s.id}
            className="bg-white rounded-lg overflow-hidden shadow relative bg-gradient-to-b from-[#fe01be] to-[#fadb9f]"
          >
            <div className="relative w-full h-48">
              <Image
                src={s.imageURL}
                alt={s.name}
                fill
                className="object-cover"
              />
            </div>

            <div className="p-4 space-y-2">
              <h2 className="text-xl font-semibold">{s.name}</h2>
              <p className="text-gray-600">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    s.address
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-blue-700 hover:text-blue-900"
                >
                  {s.address}
                </a>
              </p>
              {s.description && (
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {s.description}
                </p>
              )}
            </div>

            {isAdmin && (
              <div className="absolute top-2 right-2 flex gap-2">
                <button
                  className="px-2 py-1 bg-blue-600 text-white rounded text-sm"
                  onClick={() => openEdit(s)}
                >
                  編集
                </button>
                <button
                  className="px-2 py-1 bg-red-600 text-white rounded text-sm"
                  onClick={() => removeStore(s)}
                >
                  削除
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {isAdmin && formMode === null && (
        <button
          onClick={openAdd}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-pink-600 text-white flex items-center justify-center shadow-lg hover:bg-pink-700 active:scale-95 transition disabled:opacity-50"
        >
          <Plus size={28} />
        </button>
      )}

      {isAdmin && formMode && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 w-full max-w-md space-y-4">
            <h2 className="text-xl font-bold text-center">
              {formMode === "edit" ? "店舗を編集" : "店舗を追加"}
            </h2>

            <input
              type="text"
              placeholder="店舗名"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border px-3 py-2 rounded"
              disabled={uploading}
            />
            <input
              type="text"
              placeholder="住所"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full border px-3 py-2 rounded"
              disabled={uploading}
            />
            <textarea
              placeholder="紹介文"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border px-3 py-2 rounded"
              rows={3}
              disabled={uploading}
            />
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full"
              disabled={uploading}
            />

            {uploading && (
              <div className="space-y-2">
                <p className="text-sm text-gray-500">
                  アップロード中… {progress}%
                </p>
                <div className="w-full h-2 bg-gray-300 rounded">
                  <div
                    className="h-full bg-green-500 rounded transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-center gap-2">
              <button
                onClick={saveStore}
                disabled={uploading}
                className="px-4 py-2 bg-green-600 text-white rounded"
              >
                保存
              </button>
              <button
                onClick={closeForm}
                disabled={uploading}
                className="px-4 py-2 bg-gray-500 text-white rounded"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
