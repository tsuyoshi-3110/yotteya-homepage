import "server-only";

import type { Metadata } from "next";
import {
  loadPageMetadata,
  type MetadataPageKey,
} from "./home-metadata";
import { readCachedSiteDocument } from "./site-document-server";
import { resolveCurrentTenant } from "./tenant-resolver-server";

export async function loadPageMetadataFromFirestore({
  pageKey,
  fallback,
}: {
  pageKey: MetadataPageKey;
  fallback: Metadata;
}): Promise<Metadata> {
  const tenant = await resolveCurrentTenant();

  return loadPageMetadata({
    pageKey,
    siteKey: tenant.siteKey,
    hostname: tenant.hostname ?? "",
    fallback,
    readSiteDocument: readCachedSiteDocument,
  });
}

export function loadHomeMetadataFromFirestore({
  fallback,
}: {
  fallback: Metadata;
}): Promise<Metadata> {
  return loadPageMetadataFromFirestore({ pageKey: "home", fallback });
}
