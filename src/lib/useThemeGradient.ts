import { useEffect, useState } from "react";
import { onSnapshot, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { THEMES, ThemeKey } from "@/lib/themes";

const SITE_KEY = "yotteya";

type ThemeValue = (typeof THEMES)[ThemeKey];

export function useThemeGradient(): ThemeValue | null {
  const [gradient, setGradient] = useState<ThemeValue | null>(null); // 初期値を null に

  useEffect(() => {
    const ref = doc(db, "siteSettings", SITE_KEY);
    const unsubscribe = onSnapshot(ref, (snap) => {
      const data = snap.data();
      if (
        data?.themeGradient &&
        Object.keys(THEMES).includes(data.themeGradient)
      ) {
        const key = data.themeGradient as ThemeKey;
        setGradient(THEMES[key]);
      }
    });

    return () => unsubscribe();
  }, []);

  return gradient; // null の可能性あり
}
