import type { MetadataRoute } from "next";
import { CUSTOMER } from "../../config/customer.ts";
import type { CustomerConfig } from "../../config/customer.types";
import {
  getSiteConfigCandidate,
  type ReadSiteDocument,
} from "./home-metadata.ts";
import {
  isValidCustomerConfigOverride,
  resolveCustomerConfig,
} from "./resolve.ts";

export const SITEMAP_PATHS = [
  "/",
  "/about",
  "/news",
  "/areas/local",
  "/products",
  "/products-ec",
  "/projects",
  "/stores",
  "/faq",
] as const;

function normalizedBaseUrl(productionUrl: string): string {
  const url = new URL(productionUrl);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("unsupported productionUrl protocol");
  }
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

function absoluteUrl(baseUrl: string, pathname: string): string {
  return new URL(pathname, `${baseUrl}/`).toString();
}

export function buildTenantRobots(
  config: CustomerConfig
): MetadataRoute.Robots {
  const base = normalizedBaseUrl(config.productionUrl);
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: [`${base}/sitemap.xml`, `${base}/video-sitemap.xml`],
    host: base,
  };
}

export function buildTenantSitemap(
  config: CustomerConfig,
  lastModified = new Date().toISOString()
): MetadataRoute.Sitemap {
  const base = normalizedBaseUrl(config.productionUrl);

  return SITEMAP_PATHS.map((pathname) => ({
    url: absoluteUrl(base, pathname),
    lastModified,
    changeFrequency: pathname === "/" ? "daily" : "weekly",
    priority: pathname === "/" ? 1.0 : 0.6,
  }));
}

async function loadTenantPublicRoute<T>({
  siteKey = CUSTOMER.siteKey,
  hostname,
  fallback,
  readSiteDocument,
  build,
}: {
  siteKey?: string;
  hostname: string;
  fallback: T;
  readSiteDocument: ReadSiteDocument;
  build: (config: CustomerConfig) => T;
}): Promise<T> {
  try {
    const documentData = await readSiteDocument(siteKey, hostname);
    if (documentData === null) return fallback;

    const candidate = getSiteConfigCandidate(documentData);
    if (!isValidCustomerConfigOverride(candidate)) return fallback;

    return build(resolveCustomerConfig(candidate));
  } catch {
    return fallback;
  }
}

export function loadTenantRobots({
  siteKey,
  hostname,
  fallback,
  readSiteDocument,
}: {
  siteKey?: string;
  hostname: string;
  fallback: MetadataRoute.Robots;
  readSiteDocument: ReadSiteDocument;
}): Promise<MetadataRoute.Robots> {
  return loadTenantPublicRoute({
    siteKey,
    hostname,
    fallback,
    readSiteDocument,
    build: buildTenantRobots,
  });
}

export function loadTenantSitemap({
  siteKey,
  hostname,
  fallback,
  lastModified,
  readSiteDocument,
}: {
  siteKey?: string;
  hostname: string;
  fallback: MetadataRoute.Sitemap;
  lastModified: string;
  readSiteDocument: ReadSiteDocument;
}): Promise<MetadataRoute.Sitemap> {
  return loadTenantPublicRoute({
    siteKey,
    hostname,
    fallback,
    readSiteDocument,
    build: (config) => buildTenantSitemap(config, lastModified),
  });
}
