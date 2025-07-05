// hooks/useWallpaper.ts
"use client";
import { useEffect, useState } from "react";
import { onSnapshot, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";

const SITE_KEY = "yotteya";
const META_REF = doc(db, "siteSettings", SITE_KEY);

export function useWallpaperUrl(): string {
  const [wallpaper, setWallpaper] = useState("");

  useEffect(() => {
    const unsubscribe = onSnapshot(META_REF, (snap) => {
      const data = snap.data();
      if (
        typeof data?.imageUrl === "string" &&
        data.imageUrl.startsWith("http")
      ) {
        setWallpaper(data.imageUrl);
      } else {
        setWallpaper("");
      }
    });

    return () => unsubscribe();
  }, []);

  return wallpaper;
}
