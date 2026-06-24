import { doc, getDoc, type Firestore } from "firebase/firestore";
import { CUSTOMER } from "@/config/customer";
import type { CustomerConfig } from "@/config/customer.types";
import { db } from "@/lib/firebase";
import { resolveCustomerConfigDocument } from "./resolve";

/**
 * Firestore の `sites/{siteKey}` を一度だけ読み取り、既存設定へ重ねます。
 * ドキュメントが存在しない場合は `customer.ts` の設定をそのまま返します。
 */
export async function readCustomerConfigFromFirestore(
  firestore: Firestore,
  siteKey: string
): Promise<CustomerConfig> {
  const snapshot = await getDoc(doc(firestore, "sites", siteKey));
  return snapshot.exists()
    ? resolveCustomerConfigDocument(snapshot.data())
    : resolveCustomerConfigDocument(null);
}

/**
 * 現在のクライアントFirebase接続を使う読み取り専用の便宜関数。
 */
export function loadCustomerConfig(
  siteKey: string = CUSTOMER.siteKey
): Promise<CustomerConfig> {
  return readCustomerConfigFromFirestore(db, siteKey);
}
