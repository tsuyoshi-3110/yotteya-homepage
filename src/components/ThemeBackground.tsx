"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { THEMES, ThemeKey } from "@/lib/themes";
import { useSiteKey } from "@/lib/atoms/siteKeyAtom";

function isThemeKey(value: unknown): value is ThemeKey {
  return typeof value === "string" && Object.keys(THEMES).includes(value);
}

export default function ThemeBackground() {
  const siteKey = useSiteKey();
  const [theme, setTheme] = useState<ThemeKey | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "siteSettingsEditable", siteKey), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (isThemeKey(data.themeGradient)) {
          setTheme(data.themeGradient);
        }
      }
    });

    return () => unsub();
  }, [siteKey]);

  if (theme === null) return null;

  return (
    <div
      aria-hidden
      className={`
        pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b transition-all duration-700
        ${THEMES[theme]}
      `}
    />
  );
}
