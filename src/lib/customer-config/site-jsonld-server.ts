import "server-only";

import {
  buildDefaultSiteJsonLdGraph,
  loadSiteJsonLdGraph,
  type SiteJsonLdGraph,
} from "./site-jsonld";
import { readCachedSiteDocument } from "./site-document-server";
import { resolveCurrentTenant } from "./tenant-resolver-server";

const CURRENT_SITE_JSON_LD = buildDefaultSiteJsonLdGraph();

export async function loadSiteJsonLdGraphFromFirestore(): Promise<SiteJsonLdGraph> {
  const tenant = await resolveCurrentTenant();

  return loadSiteJsonLdGraph({
    siteKey: tenant.siteKey,
    fallback: CURRENT_SITE_JSON_LD,
    readSiteDocument: readCachedSiteDocument,
  });
}
