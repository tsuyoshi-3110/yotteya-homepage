import "server-only";

import type { MetadataRoute } from "next";
import {
  buildTenantRobots,
  buildTenantSitemap,
  loadTenantRobots,
  loadTenantSitemap,
} from "./public-routes";
import { getDefaultCustomerConfig } from "./resolve";
import { readCachedSiteDocument } from "./site-document-server";
import { resolveCurrentTenant } from "./tenant-resolver-server";

export async function loadRobotsFromFirestore(): Promise<MetadataRoute.Robots> {
  const tenant = await resolveCurrentTenant();
  const fallback = buildTenantRobots(getDefaultCustomerConfig());

  return loadTenantRobots({
    siteKey: tenant.siteKey,
    hostname: tenant.hostname ?? "",
    fallback,
    readSiteDocument: readCachedSiteDocument,
  });
}

export async function loadSitemapFromFirestore(): Promise<MetadataRoute.Sitemap> {
  const tenant = await resolveCurrentTenant();
  const lastModified = new Date().toISOString();
  const fallback = buildTenantSitemap(
    getDefaultCustomerConfig(),
    lastModified
  );

  return loadTenantSitemap({
    siteKey: tenant.siteKey,
    hostname: tenant.hostname ?? "",
    fallback,
    lastModified,
    readSiteDocument: readCachedSiteDocument,
  });
}
