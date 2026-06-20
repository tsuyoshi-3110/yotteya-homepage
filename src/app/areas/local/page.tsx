import Link from "next/link";
import type { Metadata } from "next";
import {
  PUBLIC_ADDRESS,
  copy,
  pageUrl,
  seo,
  site,
} from "@/config/site";

export const metadata: Metadata = seo.page("areasLocal");

const localCopy = copy.ja.areasLocal;

const localBusinessJsonLd = {
  "@context": "https://schema.org",
  "@type": "FoodEstablishment",
  "@id": `${pageUrl("/")}#local`,
  name: site.name,
  url: pageUrl("/areas/local"),
  image: pageUrl(site.logoPath),
  servesCuisine: ["クレープ", "スイーツ"],
  priceRange: "￥￥",
  address: PUBLIC_ADDRESS.postal,
  hasMap: PUBLIC_ADDRESS.hasMap,
  areaServed: {
    "@type": "AdministrativeArea",
    name: "大阪市東淀川区",
  },
  sameAs: Object.values(site.socials).filter(Boolean),
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: localCopy.faq.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.a,
    },
  })),
};

const safeJson = (value: object) =>
  JSON.stringify(value).replace(/</g, "\\u003c");

export default function HigashiyodogawaCrepePage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 text-black">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJson(localBusinessJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJson(faqJsonLd) }}
      />

      <article className="space-y-8 rounded-3xl border border-white/60 bg-white/70 p-6 shadow-xl backdrop-blur-md sm:p-10">
        <header className="space-y-4">
          <p className="font-semibold text-pink-700">大阪市東淀川区・淡路</p>
          <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">
            大阪市東淀川区のクレープ専門店 甘味処 よって屋
          </h1>
          <p className="text-base leading-8 sm:text-lg">
            {localCopy.lead}
            注文をいただいてから生地を焼き上げ、できたてのクレープをご提供しています。
            テイクアウトはもちろん、店舗ではイートインもご利用いただけます。
          </p>
        </header>

        <section aria-labelledby="access" className="space-y-3">
          <h2 id="access" className="text-2xl font-bold">
            淡路の店舗・アクセス
          </h2>
          <p className="leading-7">
            所在地：{PUBLIC_ADDRESS.text}
          </p>
          <a
            href={PUBLIC_ADDRESS.hasMap}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex rounded-full bg-black px-5 py-3 font-semibold text-white hover:opacity-80"
          >
            Googleマップで場所を確認
          </a>
        </section>

        <section className="grid gap-5 md:grid-cols-2">
          {localCopy.services.map((service) => (
            <div
              key={service.title}
              className="rounded-2xl border border-pink-100 bg-white/80 p-5"
            >
              <h2 className="mb-3 text-xl font-bold">{service.title}</h2>
              <ul className="list-disc space-y-2 pl-5 leading-7">
                {service.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <section aria-labelledby="coverage" className="space-y-3">
          <h2 id="coverage" className="text-2xl font-bold">
            {localCopy.coverageTitle}
          </h2>
          <p className="leading-8">{localCopy.coverageBody}</p>
          <p className="leading-8">
            東淀川区でクレープやスイーツをお探しの際は、お買い物帰り、
            学校帰り、ご家族とのおやつなどにお気軽にお立ち寄りください。
          </p>
        </section>

        <section aria-labelledby="faq" className="space-y-4">
          <h2 id="faq" className="text-2xl font-bold">
            東淀川区の店舗についてよくある質問
          </h2>
          <dl className="space-y-4">
            {localCopy.faq.map((item) => (
              <div
                key={item.q}
                className="rounded-2xl border border-white bg-white/70 p-5"
              >
                <dt className="font-bold">Q. {item.q}</dt>
                <dd className="mt-2 leading-7">A. {item.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <nav
          aria-label="関連ページ"
          className="flex flex-wrap gap-3 border-t border-pink-100 pt-6"
        >
          <Link
            href="/products"
            className="rounded-full bg-pink-600 px-5 py-3 font-semibold text-white hover:opacity-80"
          >
            クレープメニューを見る
          </Link>
          <Link
            href="/stores"
            className="rounded-full border border-black px-5 py-3 font-semibold hover:bg-black hover:text-white"
          >
            店舗情報を見る
          </Link>
          <Link
            href="/"
            className="rounded-full border border-black px-5 py-3 font-semibold hover:bg-black hover:text-white"
          >
            トップページへ戻る
          </Link>
        </nav>
      </article>
    </main>
  );
}
