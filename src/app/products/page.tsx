import type { Metadata } from "next";
import ProductsClient from "@/components/ProductsClient";

export const metadata: Metadata = {
  title: "メニュー一覧｜甘味処 よって屋",
  description:
    "甘味処 よって屋の人気クレープメニュー一覧ページ。季節限定商品やおすすめクレープを写真付きでご紹介。",
  openGraph: {
    title: "メニュー一覧｜甘味処 よって屋",
    description:
      "ふんわり生地とこだわりクリームのクレープメニューをご紹介。大阪市東淀川区の人気クレープ店。",
    url: "https://www.yotteya.shop/products",
    siteName: "甘味処 よって屋",
    images: [
      {
        url: "/ogp-products.jpg",
        width: 1200,
        height: 630,
      },
    ],
    locale: "ja_JP",
    type: "website",
  },
};

export default function ProductsPage() {
  return <ProductsClient />;
}
