"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Image from "next/image";
import Link from "next/link";
import { partnerSiteKeyAtom } from "@/lib/atoms/siteKeyAtom";
import { useSetAtom } from "jotai";
import { Inbox } from "lucide-react";

type SiteOwner = {
  id: string; // siteKey
  siteName: string;
  ownerName: string;
  ownerAddress: string;
  iconUrl: string;
  ownerId: string;
};

export default function CommunityPage() {
  const [owners, setOwners] = useState<SiteOwner[]>([]);

  const setPartnerSiteKey = useSetAtom(partnerSiteKeyAtom);
  const selfSiteKey = "yotteya"; // ← 自分の店舗 ID（ベタ書き）

  useEffect(() => {
    const fetchOwners = async () => {
      const snap = await getDocs(collection(db, "siteSettings"));

      const promises = snap.docs.map(async (docSnap) => {
        const data = docSnap.data();
        const siteKey = docSnap.id;

        const editableRef = doc(db, "siteSettingsEditable", siteKey);
        const editableSnap = await getDoc(editableRef);
        const editableData = editableSnap.exists() ? editableSnap.data() : {};

        return {
          id: siteKey,
          siteName: data.siteName ?? "(無名の店舗)",
          ownerName: data.ownerName ?? "(名前未設定)",
          ownerAddress: data.ownerAddress ?? "(住所不明)",
          ownerId: data.ownerId ?? "",
          iconUrl: editableData.headerLogoUrl ?? "/noImage.png",
        };
      });

      const allRows = await Promise.all(promises);
      setOwners(allRows.filter((row) => row.id !== selfSiteKey)); // 自分を除外
    };

    fetchOwners();
  }, []);

  return (
    <main className="max-w-3xl mx-auto p-4 ">
      <h1 className="text-2xl font-bold mb-6 text-center">オーナー一覧</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {owners.map((o) => (
          <div
            key={o.id}
            className="border rounded-lg p-4 flex items-center gap-4 shadow hover:shadow-md transition"
          >
            <Image
              src={o.iconUrl}
              alt={o.ownerName}
              width={60}
              height={60}
              className="rounded-full object-cover"
            />
            <div className="flex-1">
              <p className="font-bold">{o.siteName}</p>
              <p className="text-sm text-gray-600">{o.ownerAddress}</p>
              <p className="text-sm text-gray-500">by {o.ownerName}</p>
            </div>

            <Link
              href={`/community/message/${o.id}`}
              onClick={() => setPartnerSiteKey(o.id)} // ここだけ追加
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
            >
              メッセージ
            </Link>
          </div>
        ))}
      </div>

      {/* 受信箱 (siteKey 固定なので変更なし) */}
       <Link
        href="/community/message/inbox"
        aria-label="受信箱"
        className="
        fixed bottom-4 left-10 z-40
        flex items-center justify-center
        h-12 w-12 rounded-full
        bg-blue-600 text-white
        shadow-lg transition
        hover:bg-blue-700 focus:outline-none
      "
      >
        <Inbox className="w-6 h-6" />
      </Link>
    </main>
  );
}
