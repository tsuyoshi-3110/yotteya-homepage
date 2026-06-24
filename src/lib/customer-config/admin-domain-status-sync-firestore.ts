import {
  FieldValue,
  type Firestore,
  type Transaction,
} from "firebase-admin/firestore";
import type {
  DomainStatusSyncDependencies,
  DomainStatusSyncTransaction,
} from "./admin-domain-status-sync";
import type { RawVercelHostStatus } from "./vercel-domain-status";

export function createFirestoreDomainStatusSyncTransaction(
  firestore: Firestore,
  transaction: Transaction,
): DomainStatusSyncTransaction {
  return {
    readOwnerId: async (siteKey) => {
      const snapshot = await transaction.get(
        firestore.doc(`siteSettings/${siteKey}`),
      );
      return snapshot.exists ? snapshot.get("ownerId") : null;
    },
    readSite: async (siteKey) => {
      const snapshot = await transaction.get(firestore.doc(`sites/${siteKey}`));
      return snapshot.exists ? snapshot.data() : null;
    },
    mergeSite: (siteKey, patch) => {
      transaction.set(firestore.doc(`sites/${siteKey}`), patch, {
        merge: true,
      });
    },
  };
}

export function createAdminDomainStatusSyncDependencies({
  firestore,
  fetchHostStatus,
}: {
  firestore: Firestore;
  fetchHostStatus: (hostname: string) => Promise<RawVercelHostStatus>;
}): DomainStatusSyncDependencies {
  return {
    readOwnerId: async (siteKey) => {
      const snapshot = await firestore.doc(`siteSettings/${siteKey}`).get();
      return snapshot.exists ? snapshot.get("ownerId") : null;
    },
    readSite: async (siteKey) => {
      const snapshot = await firestore.doc(`sites/${siteKey}`).get();
      return snapshot.exists ? snapshot.data() : null;
    },
    fetchHostStatus,
    checkedAtValue: () => FieldValue.serverTimestamp(),
    runTransaction: (operation) =>
      firestore.runTransaction((transaction) =>
        operation(
          createFirestoreDomainStatusSyncTransaction(firestore, transaction),
        ),
      ),
  };
}
