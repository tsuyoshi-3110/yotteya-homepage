// components/common/Footer.tsx
"use client";

import Image from "next/image";
import ScrollUpCTA from "@/components/ScrollUpCTA";
import { useUILang, type UILang } from "@/lib/atoms/uiLangAtom";
import { FOOTER_STRINGS, site } from "@/config/site";
import clsx from "clsx";
import { useBtnClassName } from "@/lib/useBtnClassName";
import VCardDownloadButton from "@/components/common/VCardDownloadButton";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { useSiteKey } from "@/lib/atoms/siteKeyAtom";
import { CUSTOMER } from "@/config/customer";

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
  const siteKey = useSiteKey();
  const { uiLang } = useUILang();
  const lang = (uiLang in FOOTER_STRINGS ? uiLang : "ja") as UILang;
  const t = FOOTER_STRINGS[lang];
  const dir: "rtl" | "ltr" = lang === "ar" ? "rtl" : "ltr";
  const iconSize = 48;
  const btnClass = useBtnClassName();

  // Footer も Header と同じ visibleMenuKeys を購読する
  const [visibleMenuKeys, setVisibleMenuKeys] = useState<string[]>([]);

  useEffect(() => {
    const ref = doc(db, "siteSettingsEditable", siteKey);

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
  }, [siteKey]);

  const [footerData, setFooterData] = useState<{
    siteName: string;
    instagramUrl: string;
    lineUrl: string;
    xUrl: string;
    copyrightName: string;
  }>({
    siteName: site.name,
    instagramUrl: CUSTOMER.social.instagram,
    lineUrl: CUSTOMER.social.line,
    xUrl: "",
    copyrightName: CUSTOMER.brand.copyrightName,
  });

  useEffect(() => {
    import("firebase/firestore").then(({ doc: firestoreDoc, getDoc }) => {
      Promise.all([
        getDoc(firestoreDoc(db, "siteSettings", siteKey)),
        getDoc(firestoreDoc(db, "siteSettingsEditable", siteKey)),
      ]).then(([settingsSnap, editableSnap]) => {
        const s = settingsSnap.data() ?? {};
        const e = editableSnap.data() ?? {};
        setFooterData({
          siteName: (s.siteName as string) || site.name,
          instagramUrl: (e.instagramUrl as string) || CUSTOMER.social.instagram,
          lineUrl: (e.lineUrl as string) || CUSTOMER.social.line,
          xUrl: (e.xUrl as string) || "",
          copyrightName: (e.copyrightName as string) || (s.siteName as string) || CUSTOMER.brand.copyrightName,
        });
      });
    });
  }, [siteKey]);

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
              className={`${btnClass} h-12 px-5 rounded-2xl shadow-2xl font-bold`}
            />
          )}

          {/* SNS */}
          <nav className="flex items-center justify-center gap-5">
            {footerData.instagramUrl && (
              <a
                href={footerData.instagramUrl}
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
            )}

            {footerData.lineUrl && (
              <a
                href={footerData.lineUrl}
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
            )}

            {footerData.xUrl && (
              <a
                href={footerData.xUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center rounded-full bg-black"
                style={{ width: iconSize, height: iconSize }}
              >
                <svg viewBox="0 0 24 24" fill="white" width={iconSize * 0.55} height={iconSize * 0.55}>
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.402 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.912-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
            )}
          </nav>

          {/* コピーライト */}
          <p className="font-semibold">{footerData.siteName}</p>
          <p className="text-xs">
            © {new Date().getFullYear()} {footerData.copyrightName}.{" "}
            {t.rights}
          </p>
        </div>
      </div>
    </footer>
  );
}
