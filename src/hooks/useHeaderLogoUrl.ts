// hooks/useHeaderLogoUrl.ts
"use client";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { useSiteKey } from "@/lib/atoms/siteKeyAtom";

export function useHeaderLogoUrl(): string {
  const siteKey = useSiteKey();
  const [url, setUrl] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "siteSettingsEditable", siteKey),
      (snap) => {
        const data = snap.data();
        if (data?.headerLogoUrl?.startsWith("http")) {
          setUrl(data.headerLogoUrl);
        } else {
          setUrl("");
        }
      }
    );

    return () => unsub();
  }, []);

  return url;
}
