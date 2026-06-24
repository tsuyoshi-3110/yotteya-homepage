/* ---------- TextColorLoader.tsx ---------- */
"use client";

import { useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useSiteKey } from "@/lib/atoms/siteKeyAtom";

export default function TextColorLoader() {
  const siteKey = useSiteKey();

  useEffect(() => {
    (async () => {
      if (!siteKey) return;
      const snap = await getDoc(doc(db, "assets", siteKey));
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

      const outlineEnabled = data.textOutlineEnabled === true;
      const outlineColor = data.textOutlineColor ?? "#000000";
      document.documentElement.style.setProperty(
        "--text-outline-color",
        outlineEnabled ? outlineColor : "transparent"
      );
    })();
  }, [siteKey]);

  return null;
}
