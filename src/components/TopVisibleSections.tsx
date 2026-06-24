// TopVisibleSections.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { db, auth } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { useSiteKey } from "@/lib/atoms/siteKeyAtom";

import ProductsClient from "./products/ProductsClient";
import StaffClient from "./StaffClient";
import AreasClient from "./AreasClient";
import StoresClient from "./StoresClient";
import AboutClient from "./AboutClient";
import MenuPageClient from "./menu/MenuPageClient";
import NewsClient from "./NewsClient";
import ProjectsClient from "./ProjectsClient";
import HoursClient from "./HoursClient";

// [migrated to useSiteKey] META_REF

// [migrated to useSiteKey] LS_KEY

const TOP_DISPLAYABLE_ITEMS = [
  "products",
  "pricing",
  "staffs",
  "areas",
  "stores",
  "story",
  "news",
  "hours",
] as const;

const MENU_ITEMS: { key: string; label: string }[] = [
  { key: "products", label: "商品一覧" },
  { key: "projects", label: "施工実績" },
  { key: "pricing", label: "メニュー" },
  { key: "staffs", label: "スタッフ" },
  { key: "areas", label: "対応エリア" },
  { key: "stores", label: "店舗一覧" },
  { key: "story", label: "私たちの思い" },
  { key: "news", label: "お知らせ" },
  { key: "hours", label: "営業時間" },
];

function readCache(lsKey: string): { activeMenuKeys: string[]; visibleMenuKeys: string[] } | null {
  try {
    const raw = localStorage.getItem(lsKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(lsKey: string, activeMenuKeys: string[], visibleMenuKeys: string[]) {
  try {
    localStorage.setItem(lsKey, JSON.stringify({ activeMenuKeys, visibleMenuKeys }));
  } catch {
    // ignore storage errors
  }
}

function renderSection(key: string) {
  switch (key) {
    case "products":
      return <ProductsClient />;
    case "projects":
      return <ProjectsClient />;
    case "pricing":
      return <MenuPageClient />;
    case "staffs":
      return <StaffClient />;
    case "areas":
      return <AreasClient />;
    case "stores":
      return <StoresClient />;
    case "story":
      return <AboutClient />;
    case "news":
      return <NewsClient />;
    case "hours":
      return <HoursClient />;
    default:
      return null;
  }
}

export default function TopVisibleSections() {
  const siteKey = useSiteKey();
  const META_REF = doc(db, "siteSettingsEditable", siteKey);
  const LS_KEY = `${siteKey}:topSections`;
  const [activeKeys, setActiveKeys] = useState<string[]>([]);
  const [visibleKeys, setVisibleKeys] = useState<string[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // クライアントマウント直後にキャッシュを反映（SSRと競合しないよう useEffect 内で実行）
  useEffect(() => {
    const cached = readCache(LS_KEY);
    if (cached) {
      setActiveKeys(cached.activeMenuKeys);
      setVisibleKeys(cached.visibleMenuKeys);
    }
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(META_REF, (snap) => {
      const data = snap.data() as {
        activeMenuKeys?: string[];
        visibleMenuKeys?: string[];
      };
      const ak = Array.isArray(data?.activeMenuKeys) ? data!.activeMenuKeys! : [];
      const vk = Array.isArray(data?.visibleMenuKeys) ? data!.visibleMenuKeys! : [];
      setActiveKeys(ak);
      setVisibleKeys(vk);
      writeCache(LS_KEY, ak, vk);
    });
    return () => unsub();
  }, [LS_KEY, META_REF]);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => setIsLoggedIn(!!user));
    return () => unsub();
  }, []);

  const keysToShow = useMemo(
    () =>
      activeKeys.filter(
        (k) =>
          visibleKeys.includes(k) &&
          (TOP_DISPLAYABLE_ITEMS as readonly string[]).includes(k)
      ),
    [activeKeys, visibleKeys]
  );

  if (isLoggedIn) {
    return (
      <div className="py-8 text-center text-gray-500">
        ログアウト時に選択したページは表示されます
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {MENU_ITEMS.filter((item) => keysToShow.includes(item.key)).map(
        (item) => (
          <section key={item.key}>{renderSection(item.key)}</section>
        )
      )}
    </div>
  );
}
