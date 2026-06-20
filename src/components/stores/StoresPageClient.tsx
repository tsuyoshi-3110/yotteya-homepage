"use client";

import { useEffect, useState } from "react";
import StoresClient from "@/components/StoresClient";
import { PhoneSection } from "@/components/PhoneSection";
import { copy } from "@/config/site";
import { useUILang } from "@/lib/atoms/uiLangAtom";

export default function StoresPageClient() {
  const { uiLang } = useUILang();
  const [lang, setLang] = useState<keyof typeof copy>("ja");

  useEffect(() => {
    if (copy[uiLang]) setLang(uiLang);
  }, [uiLang]);

  const t = copy[lang]?.stores;

  if (!t) {
    return (
      <main className="px-4 py-16 text-center">
        <p className="text-red-500 font-semibold">
          ⚠ 翻訳データ（stores）が見つかりません。
        </p>
      </main>
    );
  }

  return (
    <main className="px-4 py-16">
      {/* Hero */}
      <section className="max-w-4xl mx-auto text-center mb-12">
        <h1 className="text-2xl lg:text-3xl font-extrabold mb-4 text-white text-outline">
          {t.heroTitle}
        </h1>

        <p className="leading-relaxed text-black">
          {t.heroIntroLine}
          <br className="hidden lg:block" />
          {t.heroTail}
        </p>
      </section>

      <section className="max-w-4xl mx-auto text-center mb-12">
        <PhoneSection />
      </section>

      <StoresClient />
    </main>
  );
}
