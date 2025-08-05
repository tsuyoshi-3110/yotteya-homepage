import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Script from "next/script";
import ThemeBackground from "@/components/ThemeBackground"; // 新規追加
import WallpaperBackground from "@/components/WallpaperBackground"; // ← 追加
import AnalyticsLogger from "@/components/AnalyticsLogger";
import FontLoader from "@/components/FontLoader";
import SubscriptionOverlay from "@/components/SubscriptionOverlay";

import {
  kosugiMaru,
  notoSansJP,
  shipporiMincho,
  reggaeOne,
  yomogi,
  hachiMaruPop,
} from "@/lib/font";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "甘味処 よって屋｜ふんわり生地のクレープ専門店",
  description:
    "大阪市東淀川区のクレープ専門店『甘味処 よって屋』。ふんわり生地とこだわりクリームが自慢です。",
  openGraph: {
    title: "甘味処 よって屋｜ふんわり生地のクレープ専門店",
    description:
      "ふんわり生地とこだわりクリームが自慢のクレープ屋さん。大阪市東淀川区で営業中。",
    url: "https://www.yotteya.shop/",
    siteName: "甘味処 よって屋",
    images: [
      {
        url: "/ogp.jpg",
        width: 1200,
        height: 630,
      },
    ],
    locale: "ja_JP",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const siteKey = "yotteya";

  return (
    <html
      lang="ja"
      className={`
        ${geistSans.variable} ${geistMono.variable}
        ${kosugiMaru.variable} ${notoSansJP.variable}
        ${yomogi.variable} ${hachiMaruPop.variable} ${reggaeOne.variable} ${shipporiMincho.variable}
        antialiased
      `}
    >
      <head>
        {/* Google Analytics */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`}
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">
          {`
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}', {
      page_path: window.location.pathname,
    });
  `}
        </Script>

        {/* その他のmeta */}
        <link
          rel="preload"
          as="image"
          href="/images/wallpaper/kamon.jpg"
          type="image/webp"
        />
        <meta name="theme-color" content="#ffffff" />
        <meta
          name="google-site-verification"
          content="UcH7-5B4bwpJxxSjIpBskahFhBRTSLRJUZ8A3LAnnFE"
        />
        <meta
          name="google-site-verification"
          content="h2O77asgMDfUmHBb7dda53OOJdsxv9GKXd5rrRgIQ-k"
        />
      </head>

      <body className="relative min-h-screen">
        <SubscriptionOverlay siteKey={siteKey} />
        <AnalyticsLogger />
        <WallpaperBackground />
        <ThemeBackground />
        {/* ヘッダー・コンテンツ */}
        <Header />
        <FontLoader />
        {children}

        {/* 構造化データ */}
        <Script
          id="ld-json"
          type="application/ld+json"
          strategy="afterInteractive"
        >
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Restaurant",
            name: "甘味処 よって屋",
            address: {
              "@type": "PostalAddress",
              addressLocality: "大阪市〇〇区",
              streetAddress: "〇〇町1-2-3",
            },
            telephone: "06-1234-5678",
            url: "https://example.com",
          })}
        </Script>
      </body>
    </html>
  );
}
