/* ---------- TextColorLoader.tsx ---------- */
"use client";

import { useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { SITE_KEY } from "@/lib/atoms/siteKeyAtom";

export default function TextColorLoader() {
  useEffect(() => {
    (async () => {
      if (!SITE_KEY) return;
      const snap = await getDoc(doc(db, "assets", SITE_KEY));
      if (!snap.exists()) return;
      const data = snap.data();
      const fields: [string, string][] = [
        ["textColorBody", "--text-color-body"],
        ["textColorTitle", "--text-color-title"],
        ["textColorHeader", "--text-color-header"],
        ["textColorMenu", "--text-color-menu"],
      ];
      for (const [field, cssVar] of fields) {
        if (data[field]) {
          document.documentElement.style.setProperty(cssVar, data[field]);
        }
      }

      // 文字枠
      const outlineEnabled = data.textOutlineEnabled === true;
      const outlineColor = data.textOutlineColor ?? "#000000";
      document.documentElement.style.setProperty(
        "--text-outline-color",
        outlineEnabled ? outlineColor : "transparent"
      );
    })();
  }, []);

  return null;
}
