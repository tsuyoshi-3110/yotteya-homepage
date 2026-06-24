import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { CUSTOMER } from "@/config/customer";
import { adminDb } from "@/lib/firebase-admin";
import {
  resolveTenantSiteKey,
  type TenantResolution,
} from "./tenant-resolver";

const readCachedDomainDocument = cache(async (hostname: string) => {
  const snapshot = await adminDb.collection("domains").doc(hostname).get();
  return snapshot.exists ? snapshot.data() : null;
});

/**
 * リクエストのHostからテナントを解決します。
 * 現在ドメイン台帳が未作成でも、必ず既存CUSTOMERへフォールバックします。
 */
export const resolveCurrentTenant = cache(
  async (): Promise<TenantResolution> => {
    const requestHeaders = await headers();
    const host =
      requestHeaders.get("x-forwarded-host") ??
      requestHeaders.get("host") ??
      "";

    return resolveTenantSiteKey({
      host,
      fallbackSiteKey: CUSTOMER.siteKey,
      readDomainDocument: readCachedDomainDocument,
    });
  }
);
