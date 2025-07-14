// src/app/(routes)/home/page.tsx

import type { Metadata } from "next";
import BackgroundVideo from "@/components/BackgroundVideo";
import TopFixedText from "@/components/TopFixedText";

export const metadata: Metadata = {
  title: "甘味処 よって屋｜サクサク生地のクレープ店",
  description:
    "大阪市東淀川区と北区に店舗を構えるクレープ専門店『甘味処 よって屋』。サクサク生地と北海道産生クリームが自慢です。季節限定クレープやかき氷も提供。",
  openGraph: {
    title: "甘味処 よって屋｜サクサク生地のクレープ専門店",
    description:
      "大阪市東淀川区・北区のクレープ専門店『甘味処 よって屋』。旬のフルーツを使った限定クレープやアイス、かき氷をご紹介。",
    url: "https://yotteya.shop/",
    siteName: "甘味処 よって屋",
    images: [
      {
        url: "/ogp-home.jpg",
        width: 1200,
        height: 630,
      },
    ],
    locale: "ja_JP",
    type: "website",
  },
  alternates: { canonical: "https://yotteya.shop/" },
};

export default function HomePage() {
  return (
    <main className="w-full overflow-x-hidden">
      {/* ① ファーストビュー：背景動画のみ */}
      <section className="relative h-screen overflow-hidden">
        <BackgroundVideo />
      </section>

      {/* ② スクロールして現れる本文 */}
      <section className="relative z-10 text-white px-4 py-20">
        {/* 編集可能な固定タイトル */}
        <TopFixedText />

        {/* SEO 用見出しとリード文 */}
        <h1 className="text-3xl lg:text-4xl font-extrabold text-center leading-tight mb-6">
          甘味処 よって屋
          <br />
          サクサク生地のクレープ
        </h1>

        <p className="max-w-3xl mx-auto text-center leading-relaxed ">
          大阪市東淀川区で開業１年。独自ブレンドのオリジナル粉で焼き上げる
          “外サクサク・中モチモチ”クレープが評判です。下新庄店ではアイスクリーム、
          淡路店ではふわふわかき氷も提供。テイクアウト・イートインどちらも歓迎。
        </p>
      </section>

      {/* ③ 構造化データ (JSON-LD) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            {
              "@context": "https://schema.org",
              "@type": "Restaurant",
              name: "甘味処 よって屋 東淀川店",
              address: {
                "@type": "PostalAddress",
                addressLocality: "大阪市東淀川区",
              },
              servesCuisine: "Crepe",
              url: "https://yotteya.shop/",
            },
            {
              "@context": "https://schema.org",
              "@type": "Restaurant",
              name: "甘味処 よって屋 北区店",
              address: {
                "@type": "PostalAddress",
                addressLocality: "大阪市北区",
              },
              servesCuisine: "Crepe",
              url: "https://yotteya.shop/",
            },
          ]),
        }}
      />
    </main>
  );
}
