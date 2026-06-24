// hooks/useWallpaper.ts
"use client";
import { useEffect, useState } from "react";
import { onSnapshot, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useSiteKey } from "@/lib/atoms/siteKeyAtom";

export function useWallpaperUrl(): string {
  const siteKey = useSiteKey();
  const [wallpaper, setWallpaper] = useState("");

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, "siteSettingsEditable", siteKey),
      (snap) => {
        const data = snap.data();
        if (
          typeof data?.imageUrl === "string" &&
          data.imageUrl.startsWith("http")
        ) {
          setWallpaper(data.imageUrl);
        } else {
          setWallpaper("");
        }
      }
    );

    return () => unsubscribe();
  }, [siteKey]);

  return wallpaper;
}
