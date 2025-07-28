"use client";

import { useEffect, useRef, useState } from "react";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  setDoc,
  doc,
  writeBatch,
  getDoc, // ★ 追加
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useAtomValue } from "jotai";
import { partnerSiteKeyAtom } from "@/lib/atoms/siteKeyAtom";
import Image from "next/image"; // ★ 追加
import dayjs from "dayjs";

/* ───────── あなた自身の siteKey ───────── */
const MY_SITE_KEY = "yotteya";
const DUMMY_IMG = "/noImage.png"; // 画像が無い時のフォールバック

/* ---------- 型 ---------- */
type Message = {
  id: string;
  senderSiteKey: string;
  text: string;
  createdAt?: any;
  read: boolean;
};

export default function MessagePage() {
  const partnerSiteKey = useAtomValue(partnerSiteKeyAtom);

  const [uid, setUid] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* ★ 互いのロゴ URL を保持 */
  const [logos, setLogos] = useState<{ my?: string; partner?: string }>({});

  /* ---- ログイン UID 監視 ---- */
  useEffect(() => auth.onAuthStateChanged((u) => setUid(u?.uid ?? null)), []);

  /* ---- ロゴを取得 ---- */
  useEffect(() => {
    if (!partnerSiteKey) return;

    const fetchLogo = async (siteKey: string) => {
      const snap = await getDoc(doc(db, "siteSettingsEditable", siteKey));
      return snap.exists() ? (snap.data().headerLogoUrl as string) : undefined;
    };

    (async () => {
      const [myLogo, partnerLogo] = await Promise.all([
        fetchLogo(MY_SITE_KEY),
        fetchLogo(partnerSiteKey),
      ]);
      setLogos({
        my: myLogo ?? DUMMY_IMG,
        partner: partnerLogo ?? DUMMY_IMG,
      });
    })();
  }, [partnerSiteKey]);

  /* ---- メッセージ購読 + 既読更新 ---- */
  useEffect(() => {
    if (!partnerSiteKey) return;

    const convId = [MY_SITE_KEY, partnerSiteKey].sort().join("__");
    const q = query(
      collection(db, "siteMessages", convId, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(q, async (snap) => {
      setMessages(
        snap.docs.map(
          (d) => ({ id: d.id, ...(d.data() as Omit<Message, "id">) } as Message)
        )
      );

      /* 未読まとめて既読に */
      const batch = writeBatch(db);
      let changed = false;
      snap.docs.forEach((d) => {
        const m = d.data() as Message;
        if (!m.read && m.senderSiteKey !== MY_SITE_KEY) {
          batch.update(d.ref, { read: true });
          changed = true;
        }
      });
      if (changed) await batch.commit();

      /* 末尾スクロール */
      setTimeout(
        () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
        40
      );
    });

    return () => unsub();
  }, [partnerSiteKey]);

  /* ---- 送信 ---- */
  const sendMessage = async () => {
    if (!text.trim() || !uid || !partnerSiteKey) return;

    const convId = [MY_SITE_KEY, partnerSiteKey].sort().join("__");
    const msgRef = collection(db, "siteMessages", convId, "messages");

    await addDoc(msgRef, {
      senderUid: uid,
      senderSiteKey: MY_SITE_KEY,
      text: text.trim(),
      createdAt: serverTimestamp(),
      read: false,
    });

    const myMeta = doc(
      db,
      "siteMessageMeta",
      MY_SITE_KEY,
      "conversations",
      partnerSiteKey
    );
    const hisMeta = doc(
      db,
      "siteMessageMeta",
      partnerSiteKey,
      "conversations",
      MY_SITE_KEY
    );

    const metaPayload = (partner: string) => ({
      partnerSiteKey: partner,
      lastMessage: text.trim(),
      updatedAt: serverTimestamp(),
    });

    await Promise.all([
      setDoc(myMeta, metaPayload(partnerSiteKey), { merge: true }),
      setDoc(hisMeta, metaPayload(MY_SITE_KEY), { merge: true }),
    ]);

    setText("");
  };

  /* ---- 相手未選択ならガード ---- */
  if (!partnerSiteKey) {
    return (
      <main className="pt-20 text-center text-gray-600">
        相手が選択されていません。
        <br />
        チャット一覧に戻ってください。
      </main>
    );
  }

  /* ---------- UI ---------- */
  return (
    <main className="max-w-xl mx-auto pt-20 flex flex-col h-[calc(100vh-5rem)]">
      <h1 className="text-xl font-bold mb-2 text-center text-white">
        {partnerSiteKey} とのメッセージ
      </h1>

      {/* --- メッセージ一覧 --- */}
      <div className="flex-1 overflow-y-auto px-2 py-4 bg-gray-100/30 space-y-4 rounded-lg">
        {messages.map((m, idx) => {
          const isMe = m.senderSiteKey === MY_SITE_KEY;
          const isLast = isMe && idx === messages.length - 1;
          const logo = isMe ? logos.my : logos.partner;

          return (
            <div
              key={m.id}
              className={`flex items-end ${isMe ? "justify-end" : ""}`}
            >
              {/* 相手側のときはアイコン → 吹き出し */}
              {!isMe && (
                <Image
                  src={logo ?? DUMMY_IMG}
                  alt="logo"
                  width={32}
                  height={32}
                  className="rounded-full mr-2 shrink-0"
                />
              )}

              <div
                className={`
                  max-w-[75%] px-4 py-2 rounded-xl text-sm shadow
                  ${
                    isMe
                      ? "bg-blue-500 text-white rounded-br-none"
                      : "bg-gray-300 text-black rounded-bl-none"
                  }
                `}
              >
                <p className="break-words whitespace-pre-wrap">{m.text}</p>
                <p className="text-[10px] mt-1 text-right opacity-70">
                  {m.createdAt?.toDate
                    ? dayjs(m.createdAt.toDate()).format("HH:mm")
                    : ""}
                  {isLast && (
                    <span className="ml-1">{m.read ? "既読" : "送信"}</span>
                  )}
                </p>
              </div>

              {/* 自分側のときは吹き出し → アイコン */}
              {isMe && (
                <Image
                  src={logo ?? DUMMY_IMG}
                  alt="logo"
                  width={32}
                  height={32}
                  className="rounded-full ml-2 shrink-0"
                />
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* --- 入力フォーム --- */}
      <div className="p-2 border-t flex gap-2 bg-white">
        +{" "}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            /* 高さを自動調整 */
            if (textareaRef.current) {
              textareaRef.current.style.height = "auto";
              textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          rows={1}
          placeholder="メッセージを入力"
          className="
     flex-1 rounded-2xl border px-3 py-2 text-sm leading-6
     resize-none overflow-hidden
     max-h-40           /* 伸び過ぎ防止 (≈160px) */
    focus:outline-none
   "
        />
        <button
          onClick={sendMessage}
          className="px-4 py-2 bg-blue-600 text-white rounded-full text-sm disabled:opacity-50"
          disabled={!text.trim()}
        >
          送信
        </button>
      </div>
    </main>
  );
}
