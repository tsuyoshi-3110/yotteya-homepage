"use client";

import { useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { SITE_KEY } from "@/lib/atoms/siteKeyAtom";

const TEXTURE_CLASSES = ["texture-dots", "texture-stripes", "texture-grid", "texture-cross"];

export default function CardOpacityInjector() {
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "siteSettingsEditable", SITE_KEY),
      (snap) => {
        const data = snap.data();

        // カード透明度
        if (typeof data?.cardOpacity === "number") {
          document.documentElement.style.setProperty("--card-opacity", String(data.cardOpacity));
        }

        // アクセントカラー
        if (typeof data?.accentColor === "string" && data.accentColor) {
          document.documentElement.style.setProperty("--accent-color", data.accentColor);
        }

        // 背景テクスチャ
        document.body.classList.remove(...TEXTURE_CLASSES);
        if (typeof data?.bgTexture === "string" && data.bgTexture !== "none") {
          document.body.classList.add(`texture-${data.bgTexture}`);
        }
      }
    );
    return () => unsub();
  }, []);

  return null;
}
