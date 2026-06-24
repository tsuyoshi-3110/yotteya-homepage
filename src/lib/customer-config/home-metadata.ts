import type { Metadata } from "next";
import { CUSTOMER } from "../../config/customer.ts";
import type { CustomerConfig } from "../../config/customer.types";
import {
  isValidCustomerConfigOverride,
  resolveCustomerConfig,
} from "./resolve.ts";

type UnknownRecord = Record<string, unknown>;

export type ReadSiteDocument = (
  siteKey: string,
  hostname: string
) => Promise<unknown | null>;

export type MetadataPageKey =
  | "home"
  | "about"
  | "news"
  | "areasLocal"
  | "products"
  | "productsEC"
  | "projects"
  | "stores"
  | "faq";

type MetadataPageDefinition = {
  path: string;
  title: (config: CustomerConfig) => string;
  description: (config: CustomerConfig) => string;
  type: "website" | "article";
  imagePath?: string;
};

const PAGE_DEFINITIONS: Record<MetadataPageKey, MetadataPageDefinition> = {
  home: {
    path: "/",
    title: (config) => config.seo.homeTitle,
    description: (config) => config.seo.homeDescription,
    type: "website",
  },
  about: {
    path: "/about",
    title: (config) => `当店の思い｜${config.brand.name}`,
    description: (config) => config.seo.aboutDescription,
    type: "website",
  },
  news: {
    path: "/news",
    title: (config) => `お知らせ｜${config.brand.name}`,
    description: (config) =>
      `${config.brand.name} の最新情報・限定メニュー・営業時間などのお知らせ。`,
    type: "website",
  },
  areasLocal: {
    path: "/areas/local",
    title: (config) => config.seo.localTitle,
    description: (config) => config.seo.localDescription,
    type: "article",
  },
  products: {
    path: "/products",
    title: (config) => `メニュー一覧｜${config.brand.name}`,
    description: (config) => config.seo.productsDescription,
    type: "website",
    imagePath: "/ogp-products.jpg",
  },
  // 現行 /productsEC は seo.page("products") を使用しているため値を維持する。
  productsEC: {
    path: "/products",
    title: (config) => `メニュー一覧｜${config.brand.name}`,
    description: (config) => config.seo.productsDescription,
    type: "website",
    imagePath: "/ogp-products.jpg",
  },
  projects: {
    path: "/projects",
    title: (config) => config.seo.projectsTitle,
    description: (config) => config.seo.projectsDescription,
    type: "website",
  },
  stores: {
    path: "/stores",
    title: (config) => `店舗一覧｜${config.brand.name}`,
    description: (config) => config.seo.storesDescription,
    type: "website",
  },
  faq: {
    path: "/faq",
    title: (config) => `よくある質問（FAQ）｜${config.brand.name}`,
    description: (config) => config.seo.faqDescription,
    type: "article",
  },
};

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function absoluteUrl(baseUrl: string, path: string): string {
  return new URL(path, `${baseUrl.replace(/\/$/, "")}/`).toString();
}

export function buildPageMetadata(
  pageKey: MetadataPageKey,
  config: CustomerConfig
): Metadata {
  const page = PAGE_DEFINITIONS[pageKey];
  const title = page.title(config);
  const description = page.description(config);
  const canonical = absoluteUrl(config.productionUrl, page.path);
  const image = absoluteUrl(
    config.productionUrl,
    page.imagePath ?? config.brand.logoPath
  );

  return {
    title,
    description,
    keywords: Array.from(config.brand.keywords),
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: config.brand.name,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: config.brand.name,
        },
      ],
      locale: "ja_JP",
      type: page.type,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export function buildHomeMetadata(config: CustomerConfig): Metadata {
  return buildPageMetadata("home", config);
}

export function getSiteConfigCandidate(documentData: unknown): unknown | null {
  if (!isRecord(documentData)) return null;
  if ("config" in documentData) {
    return isRecord(documentData.config) ? documentData.config : null;
  }
  return documentData;
}

export async function loadHomeMetadata({
  siteKey = CUSTOMER.siteKey,
  hostname,
  fallback,
  readSiteDocument,
}: {
  siteKey?: string;
  hostname: string;
  fallback: Metadata;
  readSiteDocument: ReadSiteDocument;
}): Promise<Metadata> {
  return loadPageMetadata({
    pageKey: "home",
    siteKey,
    hostname,
    fallback,
    readSiteDocument,
  });
}

export async function loadPageMetadata({
  pageKey,
  siteKey = CUSTOMER.siteKey,
  hostname,
  fallback,
  readSiteDocument,
}: {
  pageKey: MetadataPageKey;
  siteKey?: string;
  hostname: string;
  fallback: Metadata;
  readSiteDocument: ReadSiteDocument;
}): Promise<Metadata> {
  try {
    const documentData = await readSiteDocument(siteKey, hostname);
    if (documentData === null) return fallback;

    const candidate = getSiteConfigCandidate(documentData);
    if (!isValidCustomerConfigOverride(candidate)) return fallback;

    return buildPageMetadata(pageKey, resolveCustomerConfig(candidate));
  } catch {
    return fallback;
  }
}
