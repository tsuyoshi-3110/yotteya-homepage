"use client";

import { useEffect, useRef, useState } from "react";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";

type TextItem = {
  id: string;
  x: number;
  y: number;
  text: string;
  editing?: boolean;
};
const DOC_REF = doc(db, "siteSettings", "yotteya", "freeTexts", "home");

export default function FreeTextCanvas() {
  const [texts, setTexts] = useState<TextItem[]>([]);
  const [user, setUser] = useState<null | { uid: string }>(null);
  const [adding, setAdding] = useState(false);

  const dragId = useRef<string | null>(null);
  const offset = useRef({ x: 0, y: 0 });
  const saveTmr = useRef<NodeJS.Timeout>(undefined);

  /* 認証監視 */
  useEffect(() => onAuthStateChanged(auth, (u) => setUser(u)), []);

  /* 初回ロード */
  useEffect(
    () =>
      onSnapshot(DOC_REF, (snap) => {
        if (snap.exists()) setTexts(snap.data().texts as TextItem[]);
      }),
    []
  );

  /* 1 秒後に保存 */
  useEffect(() => {
    if (!user) return;
    if (saveTmr.current) clearTimeout(saveTmr.current);
    saveTmr.current = setTimeout(
      () =>
        setDoc(
          DOC_REF,
          { texts, updatedAt: serverTimestamp() },
          { merge: true }
        ),
      1000
    );
  }, [texts, user]);

  /* 追加クリック */
  const handleAdd = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!user || !adding) return;
    if ((e.target as HTMLElement).dataset.type === "text") return;
    const rect = e.currentTarget.getBoundingClientRect();
    setTexts((p) => [
      ...p,
      {
        id: uuidv4(),
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        text: "テキスト",
        editing: true,
      },
    ]);
    setAdding(false);
  };

  /* ドラッグ */
  const startDrag = (e: React.PointerEvent, id: string) => {
    if (!user) return;
    dragId.current = id;
    offset.current = { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragId.current || !user) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setTexts((p) =>
      p.map((t) =>
        t.id === dragId.current
          ? {
              ...t,
              x: e.clientX - rect.left - offset.current.x,
              y: e.clientY - rect.top - offset.current.y,
            }
          : t
      )
    );
  };
  const stopDrag = () => (dragId.current = null);

  /* 編集 */
  const enterEdit = (id: string) =>
    user &&
    setTexts((p) => p.map((t) => (t.id === id ? { ...t, editing: true } : t)));
  const leaveEdit = (id: string) =>
    setTexts((p) => p.map((t) => (t.id === id ? { ...t, editing: false } : t)));
  const changeText = (id: string, v: string) =>
    setTexts((p) => p.map((t) => (t.id === id ? { ...t, text: v } : t)));

  return (
    <>
      {/* 追加ボタン */}
      {user && (
        <button
          onClick={() => setAdding((v) => !v)}
          className={`fixed bottom-5 right-5 z-50 w-12 h-12 rounded-full
                      ${
                        adding ? "bg-green-600" : "bg-pink-600"
                      } text-white text-3xl shadow-lg`}
        >
          {adding ? "×" : "+"}
        </button>
      )}

      {/* キャンバス */}
      <div
        className={`absolute inset-0 z-30 select-none ${
          adding ? "cursor-crosshair" : ""
        }`}
        onClick={handleAdd}
        onPointerMove={onDrag}
        onPointerUp={stopDrag}
      >
        {texts.map((t) => (
          <div
            key={t.id}
            style={{ left: t.x, top: t.y }}
            className="absolute"
            data-type="text"
            onPointerDown={(e) => startDrag(e, t.id)}
            onDoubleClick={() => enterEdit(t.id)}
          >
            {t.editing ? (
              <input
                autoFocus
                value={t.text}
                onChange={(e) => changeText(t.id, e.target.value)}
                onBlur={() => leaveEdit(t.id)}
                className="bg-transparent border-b border-dashed border-white text-white outline-none"
              />
            ) : (
              <span
                className={`text-xl font-bold text-white ${
                  user ? "cursor-move" : "cursor-not-allowed opacity-60"
                }`}
              >
                {t.text}
              </span>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
