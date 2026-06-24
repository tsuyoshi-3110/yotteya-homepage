"use client";
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useSiteKey } from "./atoms/siteKeyAtom";
import { useThemeGradient } from "./useThemeGradient";

/** ボタンの背景クラスを返す。設定に応じてアクセントカラーかテーマグラデーションを切り替える */
export function useBtnClassName() {
  const siteKey = useSiteKey();
  const gradient = useThemeGradient();
  const [useGradient, setUseGradient] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "siteSettingsEditable", siteKey), (snap) => {
      setUseGradient(!!snap.data()?.useBgGradientForBtn);
    });
    return () => unsub();
  }, [siteKey]);

  if (useGradient && gradient) {
    return `bg-gradient-to-r ${gradient} text-black`;
  }
  return "accent-btn text-white";
}
