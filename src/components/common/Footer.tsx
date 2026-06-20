// components/common/Footer.tsx
"use client";

import Image from "next/image";
import ScrollUpCTA from "@/components/ScrollUpCTA";
import { useUILang, type UILang } from "@/lib/atoms/uiLangAtom";
import { FOOTER_STRINGS, site } from "@/config/site";
import clsx from "clsx";
import { useThemeGradient } from "@/lib/useThemeGradient";
import VCardDownloadButton from "@/components/common/VCardDownloadButton";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { SITE_KEY } from "@/lib/atoms/siteKeyAtom";

// Header と完全に同じ Menu キー一覧
const MENU_KEYS = [
  "home",
  "productsEC",
  "products",
  "projects",
  "staffs",
  "pricing",
  "hours",
  "areas",
  "stores",
  "story",
  "blog",
  "news",
  "company",
  "contact",
  "reserve",
  "aiChat",
  "partners",

  // ★ フッター専用キーを追加
  "footerCTA",
  "footerVCard",
];

export default function Footer() {
  const { uiLang } = useUILang();
  const lang = (uiLang in FOOTER_STRINGS ? uiLang : "ja") as UILang;
  const t = FOOTER_STRINGS[lang];
  const dir: "rtl" | "ltr" = lang === "ar" ? "rtl" : "ltr";
  const iconSize = 48;
  const gradient = useThemeGradient();

  // Footer も Header と同じ visibleMenuKeys を購読する
  const [visibleMenuKeys, setVisibleMenuKeys] = useState<string[]>([]);

  useEffect(() => {
    const ref = doc(db, "siteSettingsEditable", SITE_KEY);

    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;

      const data = snap.data() as any;

      const allowed = new Set(MENU_KEYS);

      // ⭐ baseKeys を string[] として扱う
      const baseKeys: string[] = Array.isArray(data.visibleMenuKeys)
        ? data.visibleMenuKeys.filter((k: any) => allowed.has(k))
        : MENU_KEYS;

      // ⭐ next も Set<string> と明示
      const next: Set<string> = new Set(baseKeys);

      // 営業時間の ON/OFF
      const bhEnabled = data.businessHours?.enabled === true;
      if (bhEnabled) next.add("hours");
      else next.delete("hours");

      // ⭐ ここで string[] 型に変換する
      setVisibleMenuKeys(Array.from(next));
    });

    return () => unsub();
  }, []);

  // Footer が使うキー
  const showContactCTA = visibleMenuKeys.includes("footerCTA");
  const showVCard = visibleMenuKeys.includes("footerVCard");

  return (
    <footer
      dir={dir}
      className="relative z-20 mt-10 border-t bg-white/30 text-sm text-black backdrop-blur "
    >
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col items-center gap-6 text-center">
          {/* 🔵 問い合わせ CTA */}
          {showContactCTA && (
            <ScrollUpCTA
              href="/contact"
              label={t.cta}
              className="w-full max-w-xs sm:max-w-sm"
            />
          )}

          {/* 🔵 vCard ボタン */}
          {showVCard && (
            <VCardDownloadButton
              className={clsx(
                "h-12 px-5 rounded-2xl shadow-2xl font-bold text-black",
                gradient
                  ? ["bg-linear-to-r", gradient, "hover:brightness-110"]
                  : "bg-emerald-600 hover:bg-emerald-700"
              )}
            />
          )}

          {/* SNS */}
          <nav className="flex items-center justify-center gap-5">
            <a
              href="https://www.instagram.com/yuki.tayotte2017"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Image
                src="/images/instagram-logo.png"
                alt="Instagram"
                width={iconSize}
                height={iconSize}
              />
            </a>

            <a
              href="https://lin.ee/YcKAJja"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Image
                src="/images/line-logo.png"
                alt="LINE"
                width={iconSize}
                height={iconSize}
              />
            </a>

            <a
              href="https://tayotteya.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Image
                src="/images/ogpLogo.png"
                alt="Site"
                width={iconSize}
                height={iconSize}
              />
            </a>
          </nav>

          {/* エリアリンク */}
          <p className="text-xs">
            <a href="/areas/local" className="hover:underline">
              {t.areaLinkText}
            </a>
          </p>

          {/* コピーライト */}
          <p className="font-semibold">{site.name}</p>
          <p className="text-xs">
            © {new Date().getFullYear()} Tayotteya. {t.rights}
          </p>
        </div>
      </div>
    </footer>
  );
}
