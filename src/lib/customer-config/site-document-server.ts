import "server-only";

import { cache } from "react";
import { adminDb } from "@/lib/firebase-admin";

/**
 * 同一サーバーレンダリング内の sites 読み取りを共有します。
 * Metadata と JSON-LD が同じドキュメントを要求しても取得は重複しません。
 */
export const readCachedSiteDocument = cache(async (siteKey: string) => {
  const snapshot = await adminDb.collection("sites").doc(siteKey).get();
  return snapshot.exists ? snapshot.data() : null;
});

/**
 * siteSettingsEditable の読み取りを同一リクエスト内でキャッシュします。
 * favicon・ヘッダーロゴなどのテナント固有アセット取得に使用します。
 */
export const readCachedSiteSettingsEditable = cache(async (siteKey: string) => {
  const snapshot = await adminDb.collection("siteSettingsEditable").doc(siteKey).get();
  return snapshot.exists ? snapshot.data() : null;
});
