"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";
import { db, auth } from "@/lib/firebase";
import { AlertCircle, Plus } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";

interface NewsItem {
  id: string;
  title: string;
  body: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  createdBy: string;
}

export default function NewsClient() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [uploading, setUploading] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);

  const SITE_KEY = "yotteya";

  const colRef = useMemo(
    () => collection(db, "siteNews", SITE_KEY, "items"),
    [SITE_KEY]
  );

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    const q = query(colRef, orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      setItems(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<NewsItem, "id">),
        }))
      );
    });
  }, [colRef]);

  const openAdd = () => {
    setEditingId(null);
    setTitle("");
    setBody("");
    setModalOpen(true);
  };

  const openEdit = (item: NewsItem) => {
    setEditingId(item.id);
    setTitle(item.title);
    setBody(item.body);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setTitle("");
    setBody("");
    setAlertVisible(false);
  };

  const handleSubmit = useCallback(async () => {
    if (!user || !title.trim() || !body.trim()) {
      setAlertVisible(true);
      return;
    }

    setUploading(true);

    if (editingId) {
      await updateDoc(doc(colRef, editingId), {
        title,
        body,
        updatedAt: Timestamp.now(),
      });
    } else {
      await addDoc(colRef, {
        title,
        body,
        createdAt: Timestamp.now(),
        createdBy: user.uid,
      });
    }

    setUploading(false);
    closeModal();
    setAlertVisible(false); // 成功したらアラート非表示にする
  }, [editingId, title, body, user, colRef]);

  const handleDelete = useCallback(
    async (item: NewsItem) => {
      if (!user || !confirm("本当に削除しますか？")) return;
      await deleteDoc(doc(colRef, item.id));
      setItems((prevItems) =>
        prevItems.filter((prevItem) => prevItem.id !== item.id)
      );
      setAlertVisible(false);
    },
    [user, colRef]
  );

  return (
    <div>
      <ul className="space-y-4 p-4">
        {items.map((item) => (
          <li key={item.id} className="border rounded p-4 bg-transparent">
            <h2 className="font-bold">{item.title}</h2>
            <p className="mt-2 whitespace-pre-wrap">{item.body}</p>

            {user && (
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => openEdit(item)}
                  className="px-3 py-1 bg-blue-600 text-white rounded"
                >
                  編集
                </button>
                <button
                  onClick={() => handleDelete(item)}
                  className="px-3 py-1 bg-red-600 text-white rounded"
                >
                  削除
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {user && (
        <button
          onClick={openAdd}
          aria-label="新規追加"
          disabled={uploading}
          className="fixed bottom-6 right-6 z-20 w-14 h-14 rounded-full bg-pink-600 text-white flex items-center justify-center shadow-lg hover:bg-pink-700 active:scale-95 transition disabled:opacity-50"
        >
          <Plus size={28} />
        </button>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md space-y-4">
            <h3 className="text-xl font-bold text-center">
              {editingId ? "お知らせを編集" : "お知らせを追加"}
            </h3>
            <input
              className="w-full border px-3 py-2 rounded"
              placeholder="タイトル"
              value={title}
              onChange={(e) => setTitle(e.currentTarget.value)}
            />
            <textarea
              className="w-full border px-3 py-2 rounded h-24"
              placeholder="本文"
              value={body}
              onChange={(e) => setBody(e.currentTarget.value)}
            />
            <div>
              {alertVisible && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle />
                  <AlertTitle>入力エラー</AlertTitle>
                  <AlertDescription>
                    タイトルと本文を両方入力してください。
                  </AlertDescription>
                </Alert>
              )}
              {/* 既存のモーダルやフォームなど */}
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={handleSubmit}
                disabled={uploading}
                className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
              >
                {editingId ? "更新" : "追加"}
              </button>
              <button
                onClick={closeModal}
                className="px-4 py-2 bg-gray-300 rounded"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
