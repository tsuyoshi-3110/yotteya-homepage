import type { Metadata } from "next";
import StoresClient from "@/components/StoresClient";

export const metadata: Metadata = {
  title: "店舗一覧｜甘味処 よって屋",
  description:
    "甘味処 よって屋の店舗一覧ページ。大阪市〇〇区にある各店舗の所在地や紹介文を掲載しています。",
  openGraph: {
    title: "店舗一覧｜甘味処 よって屋",
    description:
      "甘味処 よって屋 各店舗の住所・紹介情報を掲載。大阪市〇〇区のクレープ店。",
    url: "https://yotteya-homepage.vercel.app/stores",
    siteName: "甘味処 よって屋",
    images: [
      {
        url: "/ogp-stores.jpg",
        width: 1200,
        height: 630,
      },
    ],
    locale: "ja_JP",
    type: "website",
  },
};

export default function StoresPage() {
  return <StoresClient />;
}
