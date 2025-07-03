// src/app/(routes)/home/page.tsx
import BackgroundVideo from "@/components/BackgroundVideo";
import TopFixedText from "@/components/TopFixedText";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "甘味処 よって屋｜ふんわり生地のクレープ専門店",
  description:
    "大阪市〇〇区のクレープ専門店『甘味処 よって屋』。ふんわり生地とこだわりクリームが自慢です。",
  openGraph: {
    title: "甘味処 よって屋｜ふんわり生地のクレープ専門店",
    description:
      "大阪市〇〇区のクレープ専門店『甘味処 よって屋』。季節限定や人気メニューなどご紹介。",
    url: "https://yotteya-homepage.vercel.app/", // 公開URLに合わせて
    images: [
      {
        url: "/ogp-home.jpg", // public/ogp-home.jpg に画像配置
        width: 1200,
        height: 630,
      },
    ],
    locale: "ja_JP",
    type: "website",
  },
};

export default function HomePage() {
  return (
    <main className="w-full overflow-x-hidden">
      {/* ① 画面いっぱいに背景動画だけを見せる */}
      <section className="relative h-screen w-full">
        {/* 背景動画は絶対配置で全面に */}
        <BackgroundVideo />
      </section>

      {/* ② スクロールして現れる本文・見出し */}
      <section className="relative z-10 text-white px-4 py-20 bg-transparent">
        {/* ログインユーザーが編集できる固定タイトル */}
        <TopFixedText />

        {/* SEO 用コンテンツ */}
        <h1 className="text-3xl lg:text-4xl font-extrabold mb-6 bg-transparent leading-tigh text-center">
          甘味処 よって 屋<br />
          サクサク生地の クレープ
        </h1>
        <p className="max-w-3xl mx-auto text-center leading-relaxed bg-transparent">
          大阪市東淀川区で開業１年。
          独自ブレンドのオリジナル粉で焼き上げる“外サクサク・中モチモチ”
          クレープが評判です。季節フルーツたっぷりの限定メニューに加え、
          店舗ごとにアイスクリームやふわふわかき氷も提供してます。
        </p>
      </section>
    </main>
  );
}
