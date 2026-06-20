// app/page.tsx
import type { Metadata } from "next";
import { seo } from "@/config/site";
import BackgroundVideo from "@/components/backgroundVideo/BackgroundVideo";
import TopVisibleSections from "@/components/TopVisibleSections";
import HomePageText from "@/components/HomePageText";

// ✅ 共通SEOビルダー（/config/site.ts で集中管理）
export const metadata: Metadata = seo.page("home");

export default function HomePage() {
  return (
    <main className="w-full overflow-x-hidden">
      {/* ① ファーストビュー */}
      <section className="relative h-screen overflow-hidden">
        <BackgroundVideo />
      </section>

      {/* ② テキスト紹介 */}
      <section className="relative z-10 text-white px-4 py-20">

        {/* ⬇️ ここが言語に応じて変わる */}
        <HomePageText />
        <TopVisibleSections />
      </section>
    </main>
  );
}
