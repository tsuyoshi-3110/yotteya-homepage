import { useEffect, useState } from "react";
import { onSnapshot, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { THEMES, ThemeKey } from "@/lib/themes";
import { useSiteKey } from "./atoms/siteKeyAtom";

type ThemeValue = (typeof THEMES)[ThemeKey];

export function useThemeGradient(): ThemeValue | null {
  const siteKey = useSiteKey();
  const [gradient, setGradient] = useState<ThemeValue | null>(null);

  useEffect(() => {
    const ref = doc(db, "siteSettingsEditable", siteKey);
    const unsubscribe = onSnapshot(ref, (snap) => {
      const data = snap.data();
      if (data?.themeGradient && data.themeGradient in THEMES) {
        const key = data.themeGradient as ThemeKey;
        setGradient(THEMES[key]);
      }
    });

    return () => unsubscribe();
  }, [siteKey]);

  return gradient;
}
