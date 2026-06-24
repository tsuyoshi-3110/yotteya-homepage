import "server-only";

import type { Firestore } from "firebase-admin/firestore";
import { CUSTOMER } from "@/config/customer";
import type { CustomerConfig } from "@/config/customer.types";
import { adminDb } from "@/lib/firebase-admin";
import { resolveCustomerConfigDocument } from "./resolve";

/**
 * サーバー側で `sites/{siteKey}` を一度だけ読み取る互換関数。
 * 書き込み処理は持たず、未作成のテナントは `customer.ts` へフォールバックします。
 */
export async function readCustomerConfigFromAdminFirestore(
  firestore: Firestore,
  siteKey: string
): Promise<CustomerConfig> {
  const snapshot = await firestore.collection("sites").doc(siteKey).get();
  return snapshot.exists
    ? resolveCustomerConfigDocument(snapshot.data())
    : resolveCustomerConfigDocument(null);
}

export function loadCustomerConfigOnServer(
  siteKey: string = CUSTOMER.siteKey
): Promise<CustomerConfig> {
  return readCustomerConfigFromAdminFirestore(adminDb, siteKey);
}
