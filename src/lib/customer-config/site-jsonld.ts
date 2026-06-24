import { CUSTOMER } from "../../config/customer.ts";
import type { CustomerConfig } from "../../config/customer.types";
import {
  getDefaultCustomerConfig,
  isValidCustomerConfigOverride,
  resolveCustomerConfig,
} from "./resolve.ts";

type JsonLdEntity = Record<string, unknown>;

export type SiteJsonLdGraph = {
  "@context": "https://schema.org";
  "@graph": [JsonLdEntity, JsonLdEntity, JsonLdEntity];
};

export type ReadSiteJsonLdDocument = (
  siteKey: string
) => Promise<unknown | null>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function absoluteUrl(baseUrl: string, path: string): string {
  return new URL(path, `${baseUrl.replace(/\/$/, "")}/`).toString();
}

function mapUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    address
  )}`;
}

function compactStrings(values: readonly string[]): string[] {
  return values.filter((value) => value.length > 0);
}

/**
 * layout.tsx で出力している Organization / WebSite / LocalBusiness を
 * 1つの @graph として生成します。ページ固有JSON-LDは対象に含めません。
 */
export function buildSiteJsonLdGraph(
  config: CustomerConfig
): SiteJsonLdGraph {
  const baseUrl = config.productionUrl.replace(/\/$/, "");
  const mainImage = absoluteUrl(baseUrl, config.brand.logoPath);
  const sameAs = compactStrings([
    config.social.instagram,
    config.social.line,
    config.social.x,
    config.social.facebook,
    config.social.youtube,
    config.social.tiktok,
  ]);
  const address = {
    "@type": "PostalAddress",
    addressCountry: config.address.country,
    addressRegion: config.address.region,
    addressLocality: config.address.locality,
    streetAddress: config.address.street,
    ...(config.address.postalCode
      ? { postalCode: config.address.postalCode }
      : {}),
  };
  const telephone = config.brand.telephone
    ? { telephone: config.brand.telephone }
    : {};

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${baseUrl}#org`,
        name: config.brand.name,
        url: baseUrl,
        logo: mainImage,
        image: [mainImage],
        ...telephone,
        ...(sameAs.length ? { sameAs } : {}),
      },
      {
        "@type": "WebSite",
        "@id": `${baseUrl}#website`,
        name: config.brand.name,
        url: baseUrl,
        publisher: { "@id": `${baseUrl}#org` },
      },
      {
        "@type": "LocalBusiness",
        "@id": `${baseUrl}#local`,
        name: config.brand.name,
        url: baseUrl,
        image: [mainImage],
        ...telephone,
        address,
        hasMap: mapUrl(config.address.text),
        priceRange: "￥￥",
      },
    ],
  };
}

export function buildDefaultSiteJsonLdGraph(): SiteJsonLdGraph {
  return buildSiteJsonLdGraph(getDefaultCustomerConfig());
}

function getConfigCandidate(documentData: unknown): unknown | null {
  if (!isRecord(documentData)) return null;
  if ("config" in documentData) {
    return isRecord(documentData.config) ? documentData.config : null;
  }
  return documentData;
}

/**
 * sites/{siteKey} を優先し、未作成・障害・不正データでは渡された現行値を
 * オブジェクト参照ごと維持します。Firestoreへの書き込みは行いません。
 */
export async function loadSiteJsonLdGraph({
  siteKey = CUSTOMER.siteKey,
  fallback,
  readSiteDocument,
}: {
  siteKey?: string;
  fallback: SiteJsonLdGraph;
  readSiteDocument: ReadSiteJsonLdDocument;
}): Promise<SiteJsonLdGraph> {
  try {
    const documentData = await readSiteDocument(siteKey);
    if (documentData === null) return fallback;

    const candidate = getConfigCandidate(documentData);
    if (!isValidCustomerConfigOverride(candidate)) return fallback;

    return buildSiteJsonLdGraph(resolveCustomerConfig(candidate));
  } catch {
    return fallback;
  }
}
