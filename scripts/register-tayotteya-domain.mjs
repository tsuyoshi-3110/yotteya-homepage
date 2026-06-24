#!/usr/bin/env node
/**
 * tayotteya.shop を Firestore の domains コレクションに登録するスクリプト
 */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env.local");

// .env.local を手動パース
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const idx = l.indexOf("=");
      const key = l.slice(0, idx).trim();
      let val = l.slice(idx + 1).trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      return [key, val];
    })
);

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
}

const db = getFirestore();
const SITE_KEY = "tayotteya3110";
const DOMAINS = ["tayotteya.shop", "www.tayotteya.shop"];

async function main() {
  console.log(`Firebase project: ${env.FIREBASE_PROJECT_ID}`);
  console.log(`siteKey: ${SITE_KEY}`);
  console.log("");

  // domains コレクションに登録
  for (const domain of DOMAINS) {
    const ref = db.collection("domains").doc(domain);
    const snap = await ref.get();
    if (snap.exists) {
      console.log(`✓ domains/${domain} already exists:`, snap.data());
    } else {
      await ref.set({ siteKey: SITE_KEY });
      console.log(`✅ domains/${domain} → { siteKey: "${SITE_KEY}" } を登録しました`);
    }
  }

  // sites コレクションに登録（未存在の場合のみ）
  const siteRef = db.collection("sites").doc(SITE_KEY);
  const siteSnap = await siteRef.get();
  if (siteSnap.exists) {
    console.log(`✓ sites/${SITE_KEY} already exists:`, siteSnap.data());
  } else {
    await siteRef.set({
      siteKey: SITE_KEY,
      domain: "tayotteya.shop",
      createdAt: new Date().toISOString(),
    });
    console.log(`✅ sites/${SITE_KEY} を登録しました`);
  }

  console.log("\n完了！");
}

main().catch(console.error);
