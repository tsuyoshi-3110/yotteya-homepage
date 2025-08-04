"use client";

import { useState, useEffect } from "react";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

const siteKey = "kikaikintots";

// 利用可能なフォント一覧（表示名と保存キー）
const fonts = [
  { name: "Kosugi Maru", key: "kosugi" },
  { name: "Noto Sans JP", key: "noto" },
    { name: "明朝", key: "shippori" }, // 明朝体を追加
  { name: "Reggae One", key: "reggae" },
  { name: "Yomogi", key: "yomogi" },
  { name: "Hachi Maru Pop", key: "hachimaru" },

];

export default function FontSwitcher() {
  const [selected, setSelected] = useState<string>("kosugi");

  // 初期フォントを Firestore から取得
  useEffect(() => {
    const fetchFont = async () => {
      const snap = await getDoc(doc(db, "siteSettings", siteKey));
      if (snap.exists()) {
        const font = snap.data().fontFamily;
        if (font) {
          setSelected(font);
          document.documentElement.style.setProperty(
            "--selected-font",
            `var(--font-${font})`
          );
        }
      }
    };
    fetchFont();
  }, []);

  // 選択されたフォントを反映＆保存
  const handleClick = async (fontKey: string) => {
    setSelected(fontKey);
    document.documentElement.style.setProperty(
      "--selected-font",
      `var(--font-${fontKey})`
    );
    await updateDoc(doc(db, "siteSettings", siteKey), {
      fontFamily: fontKey,
    });
  };

  return (
    <div className="flex flex-wrap gap-2 p-2">
      {fonts.map((f) => (
        <button
          key={f.key}
          onClick={() => handleClick(f.key)}
          className={`px-3 py-1 rounded border transition ${
            selected === f.key
              ? "bg-gray-200 font-bold ring-2 ring-gray-400"
              : "bg-white"
          }`}
          style={{ fontFamily: `var(--font-${f.key})` }}
        >
          {f.name}
        </button>
      ))}
    </div>
  );
}
