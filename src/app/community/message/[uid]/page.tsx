"use client";

import { useEffect, useRef, useState, KeyboardEvent } from "react";
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
  getDoc,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useAtomValue } from "jotai";
import { partnerSiteKeyAtom } from "@/lib/atoms/siteKeyAtom";
import dayjs from "dayjs";
import Image from "next/image";

/* ===== 定数 ===== */
const MY_SITE_KEY = "yotteya"; // 自分の siteKey
const DUMMY_IMG = "/noImage.png"; // ロゴが無いとき

const INPUT_H_REM = 3.5; // 入力欄 3.5rem (=56px)

/* ===== 型 ===== */
interface Message {
  id: string;
  senderSiteKey: string;
  text: string;
  createdAt?: any;
  read: boolean;
}

export default function MessagePage() {
  /* ----- 外部状態 ----- */
  const partnerSiteKey = useAtomValue(partnerSiteKeyAtom);

  /* ----- state ----- */
  const [uid, setUid] = useState<string | null>(null);
  const [messages, setMsgs] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [logos, setLogos] = useState<{ my: string; partner: string }>({
    my: DUMMY_IMG,
    partner: DUMMY_IMG,
  });
  const [kbHeight, setKb] = useState(0); // キーボードによる高さ差分

  /* ----- refs ----- */
  const listRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const initialHRef = useRef<number | null>(null); // 初期 innerHeight

  /* 1. 認証 */
  useEffect(() => auth.onAuthStateChanged((u) => setUid(u?.uid ?? null)), []);

  /* 2. ロゴ取得 */
  useEffect(() => {
    if (!partnerSiteKey) return;
    const fetchLogo = async (key: string) => {
      const snap = await getDoc(doc(db, "siteSettingsEditable", key));
      return snap.exists() ? (snap.data().headerLogoUrl as string) : undefined;
    };
    (async () => {
      const [myLogo, partnerLogo] = await Promise.all([
        fetchLogo(MY_SITE_KEY),
        fetchLogo(partnerSiteKey),
      ]);
      setLogos({ my: myLogo ?? DUMMY_IMG, partner: partnerLogo ?? DUMMY_IMG });
    })();
  }, [partnerSiteKey]);

  /* 3. メッセージ購読 */
  useEffect(() => {
    if (!partnerSiteKey) return;
    const convId = [MY_SITE_KEY, partnerSiteKey].sort().join("__");
    const q = query(
      collection(db, "siteMessages", convId, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(q, async (snap) => {
      setMsgs(
        snap.docs.map(
          (d) => ({ id: d.id, ...(d.data() as Omit<Message, "id">) } as Message)
        )
      );

      // 未読 → 既読
      const batch = writeBatch(db);
      let dirty = false;
      snap.docs.forEach((d) => {
        const m = d.data() as Message;
        if (!m.read && m.senderSiteKey !== MY_SITE_KEY) {
          batch.update(d.ref, { read: true });
          dirty = true;
        }
      });
      if (dirty) await batch.commit();

      // スクロール最下部
      requestAnimationFrame(() => {
        if (bottomRef.current && listRef.current) {
          listRef.current.scrollTo({
            top: bottomRef.current.offsetTop - 48,
            behavior: "smooth",
          });
        }
      });
    });

    return () => unsub();
  }, [partnerSiteKey]);

  /* 4. iOS キーボード差分計測 */
  useEffect(() => {
    const onResize = () => {
      if (initialHRef.current === null)
        initialHRef.current = window.innerHeight;
      const vh = window.visualViewport?.height ?? window.innerHeight;
      setKb(Math.max(0, (initialHRef.current ?? vh) - vh - 24));
    };
    window.visualViewport?.addEventListener("resize", onResize);
    return () => window.visualViewport?.removeEventListener("resize", onResize);
  }, []);

  /* 5. 送信 */
  const sendMessage = async () => {
    if (!text.trim() || !uid || !partnerSiteKey) return;
    const convId = [MY_SITE_KEY, partnerSiteKey].sort().join("__");

    await addDoc(collection(db, "siteMessages", convId, "messages"), {
      senderUid: uid,
      senderSiteKey: MY_SITE_KEY,
      text: text.trim(),
      createdAt: serverTimestamp(),
      read: false,
    });

    const upsert = (from: string, to: string) =>
      setDoc(
        doc(db, "siteMessageMeta", from, "conversations", to),
        {
          partnerSiteKey: to,
          lastMessage: text.trim(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

    await Promise.all([
      upsert(MY_SITE_KEY, partnerSiteKey),
      upsert(partnerSiteKey, MY_SITE_KEY),
    ]);

    setText("");
    textareaRef.current?.focus();
    textareaRef.current?.style.setProperty("height", "auto");
  };

  /* partner 未選択 */
  if (!partnerSiteKey) {
    return (
      <main className="pt-20 text-center text-gray-600">
        相手が選択されていません。
        <br />
        チャット一覧に戻ってください。
      </main>
    );
  }

  /* 動的計算 */
  const bottomPad = kbHeight + INPUT_H_REM; // 入力欄 + キーボード分

  /* ===== JSX ===== */
  return (
    <>
      <main
        className=" mt-5
  w-full md:max-w-xl mx-auto
  h-[calc(100%-4rem)]
  flex flex-col
"
        //   style={{ height: `calc(100vh - ${HEADER_H_REM}rem)` }}
      >
        {/* タイトル */}
        <h1 className="text-xl font-bold mb-2 text-center text-white">
          {partnerSiteKey} とのメッセージ
        </h1>

        {/* メッセージリスト */}
        <div
          ref={listRef}
          className="
    flex-1 overflow-y-auto        /* 親の残り高さを丸ごと使う */
    px-2 py-4 space-y-4
    bg-gray-100/30 rounded-lg

    /* ===== 端末別の上限高さ ===== */
    max-h-[calc(100dvh-160px)]    /* ① スマホ (〜767px) */
    md:max-h-[calc(100vh-184px)]  /* ② タブレット (768〜1023px) */
    lg:max-h-[calc(100vh-200px)]   /* ③ PC (≥1024px) */
  "
          style={{ paddingBottom: bottomPad }}
        >
          {messages.map((m, i) => {
            const isMe = m.senderSiteKey === MY_SITE_KEY;
            const isLast = isMe && i === messages.length - 1;
            const logo = isMe ? logos.my : logos.partner;

            return (
              <div
                key={m.id}
                className={`flex items-end ${isMe ? "justify-end" : ""}`}
              >
                {/* アイコン（相手） */}
                {!isMe && (
                  <Image
                    src={logo}
                    alt="logo"
                    width={32}
                    height={32}
                    className="rounded-full mr-2 shrink-0"
                  />
                )}

                {/* 吹き出し */}
                <div
                  className={`max-w-[75%] px-4 py-2 rounded-xl shadow text-sm ${
                    isMe
                      ? "bg-blue-500 text-white rounded-br-none"
                      : "bg-gray-300 text-black rounded-bl-none"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.text}</p>
                  <p className="text-[10px] mt-1 text-right opacity-70">
                    {m.createdAt?.toDate
                      ? dayjs(m.createdAt.toDate()).format("HH:mm")
                      : ""}
                    {isLast && (
                      <span className="ml-1">{m.read ? "既読" : "送信"}</span>
                    )}
                  </p>
                </div>

                {/* アイコン（自分） */}
                {isMe && (
                  <Image
                    src={logo}
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

        {/* 入力欄 */}
        <form
          className="border-t bg-white flex items-end gap-2 pt-2 px-2"
          style={{
            paddingBottom: "calc(env(safe-area-inset-bottom,0px) + 0.5rem)",
          }}
        >
          <textarea
            ref={textareaRef}
            value={text}
            rows={1}
            placeholder="メッセージを入力"
            onChange={(e) => {
              setText(e.target.value);
              if (textareaRef.current) {
                textareaRef.current.style.height = "auto";
                textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
              }
            }}
            onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            className="flex-1 resize-none overflow-hidden rounded-2xl border px-3 py-2 leading-6 max-h-40 text-base focus:outline-none"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            className="shrink-0 self-end rounded-full bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            送信
          </button>
        </form>
      </main>
    </>
  );
}
