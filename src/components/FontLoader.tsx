"use client";

import { useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useSiteKey } from "@/lib/atoms/siteKeyAtom";

export default function FontLoader() {
  const siteKey = useSiteKey();

  useEffect(() => {
    const fetchFont = async () => {
      if (!siteKey) return;

      const snap = await getDoc(doc(db, "assets", siteKey));

      if (snap.exists()) {
        const font = snap.data().fontFamily;
        if (font) {
          document.documentElement.style.setProperty(
            "--selected-font",
            `var(--font-${font})`
          );
        }
      }
    };

    fetchFont();
  }, [siteKey]);

  return null;
}
