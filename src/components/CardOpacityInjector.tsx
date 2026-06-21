"use client";

import { useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { SITE_KEY } from "@/lib/atoms/siteKeyAtom";

export default function CardOpacityInjector() {
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "siteSettingsEditable", SITE_KEY),
      (snap) => {
        const opacity = snap.data()?.cardOpacity;
        if (typeof opacity === "number") {
          document.documentElement.style.setProperty(
            "--card-opacity",
            String(opacity)
          );
        }
      }
    );
    return () => unsub();
  }, []);

  return null;
}
