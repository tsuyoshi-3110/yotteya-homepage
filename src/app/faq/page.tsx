// /app/faq/page.tsx
import type { Metadata } from "next";
import { seo, faqItems } from "@/config/site";
import { buildFAQJsonLd } from "@/lib/jsonld/faq";
import { loadPageMetadataFromFirestore } from "@/lib/customer-config/home-metadata-server";

const CURRENT_METADATA: Metadata = seo.page("faq");

export function generateMetadata(): Promise<Metadata> {
  return loadPageMetadataFromFirestore({
    pageKey: "faq",
    fallback: CURRENT_METADATA,
  });
}

const safe = (o: object) => JSON.stringify(o).replace(/</g, "\\u003c");

export default function FAQPage() {
  const jsonLd = buildFAQJsonLd(faqItems);

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      {/* FAQ 構造化データ（ページ単位で埋め込み） */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safe(jsonLd) }}
      />

      <h1 className="text-3xl font-extrabold mb-6">よくある質問（FAQ）</h1>

      <dl className="space-y-6">
        {faqItems.map((f, i) => (
          <div key={i} className="card-bg rounded-2xl p-4 shadow">
            <dt className="font-bold mb-2">Q. {f.question}</dt>
            <dd className="leading-relaxed">A. {f.answer}</dd>
          </div>
        ))}
      </dl>
    </main>
  );
}
