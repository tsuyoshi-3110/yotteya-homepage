/* src/app/layout.tsx ─ 抜粋 */

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";

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
    <html lang="ja">
      <body
        /* ❶ フォント類 */
        className={`${geistSans.variable} ${geistMono.variable} antialiased relative`}
        /* ❷ ここで壁紙を直接適用 */
        style={{
          backgroundImage: `url(${WALLPAPER})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundAttachment: "fixed",
        }}
      >
        {/* 他ページより常に背面なので追加の z-index 調整は不要 */}
        <Header />
        {children}
      </body>
    </html>
  );
}
