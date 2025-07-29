"use client";
import { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";

export default function ReplyForm({
  postId,
  onDone,
}: {
  postId: string;
  onDone?: () => void;
}) {
  const [text, setText] = useState("");
  const uid = auth.currentUser?.uid;
  const name = auth.currentUser?.displayName ?? "Anonymous";

  const handleSubmit = async () => {
    if (!text.trim() || !uid) return;
    await addDoc(collection(db, "posts", postId, "replies"), {
      content: text.trim(),
      authorUid: uid,
      authorName: name,
      createdAt: serverTimestamp(),
    });
    setText("");
    onDone?.(); // フォームを閉じる
  };

  return (
    <div className="mt-2 space-y-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="返信を入力"
        className="w-full border rounded p-2"
      />
      <button
        onClick={handleSubmit}
        disabled={!text.trim()}
        className="rounded bg-blue-600 px-4 py-1 text-white disabled:opacity-40"
      >
        返信する
      </button>
    </div>
  );
}
