"use client";
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { SITE_KEY } from "@/lib/atoms/siteKeyAtom";
import { useThemeGradient } from "./useThemeGradient";

/** ボタンの背景クラスを返す。設定に応じてアクセントカラーかテーマグラデーションを切り替える */
export function useBtnClassName() {
  const gradient = useThemeGradient();
  const [useGradient, setUseGradient] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "siteSettingsEditable", SITE_KEY), (snap) => {
      setUseGradient(!!snap.data()?.useBgGradientForBtn);
    });
    return () => unsub();
  }, []);

  if (useGradient && gradient) {
    return `bg-gradient-to-r ${gradient} text-black`;
  }
  return "accent-btn text-white";
}
