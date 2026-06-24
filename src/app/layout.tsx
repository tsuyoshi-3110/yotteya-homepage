// app/layout.tsx
import "./globals.css";
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import Header from "@/components/common/Header";
import Footer from "@/components/common/Footer";
import ThemeBackground from "@/components/ThemeBackground";
import WallpaperBackground from "@/components/WallpaperBackground";
import SubscriptionOverlay from "@/components/SubscriptionOverlay";
import AnalyticsLogger from "@/components/AnalyticsLogger";
import TextColorLoader from "@/components/TextColorLoader";
import CardOpacityInjector from "@/components/CardOpacityInjector";
import { CartProvider } from "@/lib/cart/CartContext";
import { seo, site } from "@/config/site";
import { loadSiteJsonLdGraphFromFirestore } from "@/lib/customer-config/site-jsonld-server";
import { resolveCurrentTenant } from "@/lib/customer-config/tenant-resolver-server";
import { readCachedSiteDocument } from "@/lib/customer-config/site-document-server";
import { resolveCustomerConfigDocument } from "@/lib/customer-config/resolve";
import { SiteKeyProvider } from "@/lib/context/SiteKeyContext";
import {
  kosugiMaru, notoSansJP, shipporiMincho, reggaeOne, yomogi, hachiMaruPop,
} from "@/lib/font";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export async function generateMetadata(): Promise<Metadata> {
  const base = seo.base();
  try {
    const tenant = await resolveCurrentTenant();
    const doc = await readCachedSiteDocument(tenant.siteKey);
    const config = resolveCustomerConfigDocument(doc);
    const title = `${config.brand.name}｜${config.brand.tagline}`;
    const description = config.brand.description;
    return {
      ...base,
      title,
      description,
      openGraph: base.openGraph
        ? { ...base.openGraph, title, description, siteName: config.brand.name }
        : undefined,
      twitter: base.twitter
        ? { ...base.twitter, title, description }
        : undefined,
    };
  } catch {
    return base;
  }
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

function toLD(obj: unknown) {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [ldGraph, tenant] = await Promise.all([
    loadSiteJsonLdGraphFromFirestore(),
    resolveCurrentTenant(),
  ]);

  return (
    <html
      lang="ja"
      className={[
        geistSans.variable, geistMono.variable,
        kosugiMaru.variable, notoSansJP.variable,
        yomogi.variable, hachiMaruPop.variable,
        reggaeOne.variable, shipporiMincho.variable,
        "antialiased",
      ].join(" ")}
    >
      <head>
        <link rel="preload" as="image" href={site.logoPath} type="image/png" />
        <Script
          id="ld-graph"
          type="application/ld+json"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: toLD(ldGraph) }}
        />
      </head>

      <body className="relative min-h-dvh flex flex-col">
        <SiteKeyProvider siteKey={tenant.siteKey}>
          <WallpaperBackground />
          <ThemeBackground />
          <TextColorLoader />
          <CardOpacityInjector />
          <AnalyticsLogger />
          <CartProvider>
            <SubscriptionOverlay siteKey={tenant.siteKey} />
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </CartProvider>
        </SiteKeyProvider>
      </body>
    </html>
  );
}
