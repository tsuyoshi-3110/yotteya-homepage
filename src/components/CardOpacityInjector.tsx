"use client";

import { useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useSiteKey } from "@/lib/atoms/siteKeyAtom";

const TEXTURE_CLASSES = ["texture-dots", "texture-stripes", "texture-grid", "texture-cross"];

export default function CardOpacityInjector() {
  const siteKey = useSiteKey();

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "siteSettingsEditable", siteKey),
      (snap) => {
        const data = snap.data();

        if (typeof data?.cardOpacity === "number") {
          document.documentElement.style.setProperty("--card-opacity", String(data.cardOpacity));
        }

        if (typeof data?.accentColor === "string" && data.accentColor) {
          document.documentElement.style.setProperty("--accent-color", data.accentColor);
        }

        document.body.classList.remove(...TEXTURE_CLASSES);
        if (typeof data?.bgTexture === "string" && data.bgTexture !== "none") {
          document.body.classList.add(`texture-${data.bgTexture}`);
        }
      }
    );
    return () => unsub();
  }, [siteKey]);

  return null;
}
