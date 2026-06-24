// src/lib/firebase-admin.ts
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (() => {
        const raw = process.env.FIREBASE_PRIVATE_KEY ?? "";
        if (!raw.includes("-----BEGIN")) {
          return Buffer.from(raw, "base64").toString("utf8");
        }
        return raw.replace(/\\n/g, "\n");
      })(),
    }),
  });
}

export const adminDb = getFirestore();
export const adminAuth = getAuth();
