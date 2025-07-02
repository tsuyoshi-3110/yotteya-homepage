// src/app/(routes)/home/page.tsx

import BackgroundVideo from "@/components/BackgroundVideo";
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
    <main className="relative bg-transparent">
      {/* 背景動画コンポーネント */}
      <BackgroundVideo />
      {/* ページ内の他のコンテンツがあればここに書く */}
    </main>
  );
}
