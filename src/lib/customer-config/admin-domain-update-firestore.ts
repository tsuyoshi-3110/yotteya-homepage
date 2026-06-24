import type {
  Firestore,
  Transaction,
} from "firebase-admin/firestore";
import type {
  DomainUpdateDependencies,
  DomainUpdateTransaction,
} from "./admin-domain-update";

export function createFirestoreDomainUpdateTransaction(
  firestore: Firestore,
  transaction: Transaction,
): DomainUpdateTransaction {
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
    readDomain: async (hostname) => {
      const snapshot = await transaction.get(
        firestore.doc(`domains/${hostname}`),
      );
      return snapshot.exists ? snapshot.data() : null;
    },
    mergeSite: (siteKey, patch) => {
      transaction.set(firestore.doc(`sites/${siteKey}`), patch, {
        merge: true,
      });
    },
    mergeDomain: (hostname, patch) => {
      transaction.set(firestore.doc(`domains/${hostname}`), patch, {
        merge: true,
      });
    },
  };
}

export function createAdminDomainUpdateDependencies(
  firestore: Firestore,
): DomainUpdateDependencies {
  return {
    runTransaction: (operation) =>
      firestore.runTransaction((transaction) =>
        operation(
          createFirestoreDomainUpdateTransaction(firestore, transaction),
        ),
      ),
  };
}
