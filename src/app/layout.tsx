/* ─ src/app/layout.tsx ─ */
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";

/* ★ 背景画像（出来れば webp など軽量形式で用意） */
const WALLPAPER = "/images/wallpaper/retro-crepe-bg.png";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "甘味処 よって屋",
  description: "ふんわり生地とこだわりクリームのクレープ専門店",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <head>
        {/* 背景を先読みして LCP 改善 */}
        <link rel="preload" as="image" href={WALLPAPER} type="image/webp" />
        <meta name="theme-color" content="#ffffff" />
      </head>

      <body className="relative min-h-screen">
        {/* === 背景レイヤー（下） === */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-30 bg-cover bg-center bg-fixed"
          style={{ backgroundImage: `url(${WALLPAPER})` }}
        />

        {/* === パステルグラデーション（上） === */}
        <div
          aria-hidden
          className="
            pointer-events-none fixed inset-0 -z-10
            bg-gradient-to-b
            from-pink-50/70 via-rose-50/40 to-amber-50/60
          "
        />

        {/* === 常設ヘッダー & ページ内容 === */}
        <Header />
        {children}
      </body>
    </html>
  );
}
