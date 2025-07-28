"use client";

import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
  doc,
  getDoc, // ★ 追加：ロゴ取得用
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import Image from "next/image";
import { useAtom } from "jotai";
import { partnerSiteKeyAtom } from "@/lib/atoms/siteKeyAtom";

/* ───────── 自店舗 ID ───────── */
const MY_SITE_KEY = "yotteya";
const DUMMY_IMG = "/noImage.png";

/* ---------- 型 ---------- */
type MetaRow = {
  partnerSiteKey: string;
  lastMessage: string;
  updatedAt?: Timestamp;
  iconUrl?: string; // ← headerLogoUrl をここに格納
};

export default function InboxPage() {
  const [, setPartnerSiteKey] = useAtom(partnerSiteKeyAtom);
  const [rows, setRows] = useState<MetaRow[]>([]);

  /* メタ購読 */
  useEffect(() => {
    const q = query(
      collection(db, `siteMessageMeta/${MY_SITE_KEY}/conversations`),
      orderBy("updatedAt", "desc")
    );

    const unsub = onSnapshot(q, async (snap) => {
      /* 各行ごとに headerLogoUrl を補完してから配列を作る */
      const next = await Promise.all(
        snap.docs.map(async (d) => {
          const {
            partnerSiteKey = d.id,
            lastMessage,
            updatedAt,
            iconUrl, // メタに既にある場合
          } = d.data() as MetaRow;

          /* メタに無ければ siteSettingsEditable へフォールバック */
          let logoUrl = iconUrl;
          if (!logoUrl) {
            const setSnap = await getDoc(
              doc(db, "siteSettingsEditable", partnerSiteKey)
            );
            logoUrl = setSnap.exists()
              ? (setSnap.data().headerLogoUrl as string | undefined)
              : undefined;
          }

          return {
            partnerSiteKey,
            lastMessage,
            updatedAt,
            iconUrl: logoUrl ?? DUMMY_IMG,
          };
        })
      );

      setRows(next);
    });

    return () => unsub();
  }, []);

  /* ---------- UI ---------- */
  return (
    <main className="max-w-xl mx-auto mt-10">
      <h1 className="text-2xl font-bold mb-6 text-center">チャット一覧</h1>

      {rows.length === 0 ? (
        <p className="text-gray-500 text-sm text-center">
          メッセージ履歴がありません。
        </p>
      ) : (
        <ul className="divide-y divide-gray-300">
          {rows.map(({ partnerSiteKey, lastMessage, updatedAt, iconUrl }) => (
            <li key={partnerSiteKey}>
              <Link
                href={`/community/message/${partnerSiteKey}`}
                onClick={() => setPartnerSiteKey(partnerSiteKey)}
                className="flex items-center gap-4 px-4 py-3 hover:bg-gray-100 transition"
              >
                {/* アイコン */}
                <Image
                  src={iconUrl ?? ""}
                  alt={partnerSiteKey}
                  width={48}
                  height={48}
                  className="rounded-full object-cover"
                />

                {/* テキスト部分 */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{partnerSiteKey}</p>
                  <p className="text-sm text-gray-600 truncate">
                    {lastMessage}
                  </p>
                </div>

                {/* 送信時刻 */}
                {updatedAt && (
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {updatedAt.toDate().toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
