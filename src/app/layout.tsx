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
import { readCachedSiteDocument, readCachedSiteSettingsEditable, readCachedSiteSettings } from "@/lib/customer-config/site-document-server";
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
    const [siteDoc, editableDoc, siteSettingsDoc] = await Promise.all([
      readCachedSiteDocument(tenant.siteKey),
      readCachedSiteSettingsEditable(tenant.siteKey),
      readCachedSiteSettings(tenant.siteKey),
    ]);
    const config = resolveCustomerConfigDocument(siteDoc);
    const tagline =
      typeof siteSettingsDoc?.seoTagline === "string" && siteSettingsDoc.seoTagline
        ? siteSettingsDoc.seoTagline
        : config.brand.tagline;
    const description =
      typeof siteSettingsDoc?.seoDescription === "string" && siteSettingsDoc.seoDescription
        ? siteSettingsDoc.seoDescription
        : config.brand.description;
    const title = `${config.brand.name}｜${tagline}`;

    const logoUrl =
      typeof editableDoc?.headerLogoUrl === "string" &&
      editableDoc.headerLogoUrl.startsWith("https://")
        ? editableDoc.headerLogoUrl
        : null;

    return {
      ...base,
      title,
      description,
      icons: logoUrl
        ? { icon: [{ url: logoUrl, type: "image/png" }], apple: logoUrl }
        : undefined,
      openGraph: base.openGraph
        ? { ...base.openGraph, title, description, siteName: config.brand.name }
        : undefined,
      twitter: base.twitter
        ? { ...base.twitter, title, description }
        : undefined,
    };
  } catch {
    return { ...base, icons: undefined };
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

  let initialSiteName: string | undefined;
  try {
    const [siteDoc, siteSettingsDoc] = await Promise.all([
      readCachedSiteDocument(tenant.siteKey),
      readCachedSiteSettings(tenant.siteKey),
    ]);
    const config = resolveCustomerConfigDocument(siteDoc);
    initialSiteName =
      typeof siteSettingsDoc?.siteName === "string" && siteSettingsDoc.siteName
        ? siteSettingsDoc.siteName
        : config.brand.name;
  } catch {
    // undefined のまま → Header 側で空文字として扱う
  }

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
            <Header initialSiteName={initialSiteName} />
            <main className="flex-1">{children}</main>
            <Footer />
          </CartProvider>
        </SiteKeyProvider>
      </body>
    </html>
  );
}
