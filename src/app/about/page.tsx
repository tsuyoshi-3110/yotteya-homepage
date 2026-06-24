// app/about/page.tsx
import type { Metadata } from "next";
import AboutClient from "@/components/AboutClient";
import { seo } from "@/config/site";
import { loadPageMetadataFromFirestore } from "@/lib/customer-config/home-metadata-server";

const CURRENT_METADATA: Metadata = seo.page("about");

export function generateMetadata(): Promise<Metadata> {
  return loadPageMetadataFromFirestore({
    pageKey: "about",
    fallback: CURRENT_METADATA,
  });
}

export default function AboutPage() {
  return (
    <main className="px-4 py-4 max-w-4xl mx-auto">
      <AboutClient />
    </main>
  );
}
