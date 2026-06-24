// app/page.tsx
import type { Metadata } from "next";
import { seo } from "@/config/site";
import { loadHomeMetadataFromFirestore } from "@/lib/customer-config/home-metadata-server";
import BackgroundVideo from "@/components/backgroundVideo/BackgroundVideo";
import TopVisibleSections from "@/components/TopVisibleSections";
import HomePageText from "@/components/HomePageText";

const CURRENT_HOME_METADATA: Metadata = seo.page("home");

export async function generateMetadata(): Promise<Metadata> {
  return loadHomeMetadataFromFirestore({
    fallback: CURRENT_HOME_METADATA,
  });
}

export default function HomePage() {
  return (
    <div className="w-full overflow-x-hidden">
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
    </div>
  );
}
