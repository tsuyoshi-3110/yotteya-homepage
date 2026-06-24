#!/usr/bin/env node
/**
 * 新テナント追加スクリプト
 * 使い方: node scripts/add-tenant.mjs
 */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { createInterface } from "readline";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env.local");

// .env.local をパース
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

// ── ユーティリティ ──────────────────────────────────
const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q, fallback = "") =>
  new Promise((res) =>
    rl.question(fallback ? `${q} [${fallback}]: ` : `${q}: `, (a) =>
      res(a.trim() || fallback)
    )
  );

function validateSiteKey(key) {
  return /^[a-z0-9][a-z0-9\-]{1,}$/.test(key);
}
function validateDomain(d) {
  return /^[a-z0-9][a-z0-9\-\.]+\.[a-z]{2,}$/.test(d);
}

// ── メイン ──────────────────────────────────────────
async function main() {
  console.log("\n========================================");
  console.log("  PageIt Platform — 新テナント追加");
  console.log(`  Firebase: ${env.FIREBASE_PROJECT_ID}`);
  console.log("========================================\n");

  // 1. 入力収集
  let siteKey;
  while (true) {
    siteKey = await ask("siteKey（英小文字・数字・ハイフン、例: newshop01）");
    if (validateSiteKey(siteKey)) break;
    console.log("  ✗ 英小文字・数字・ハイフンのみ使用可（先頭は英数字）");
  }

  let domain;
  while (true) {
    domain = await ask("ドメイン（例: newshop.jp）");
    if (validateDomain(domain)) break;
    console.log("  ✗ 正しいドメイン形式で入力してください");
  }

  const addWww = (await ask("www.ドメインも登録しますか？ (y/n)", "y")) === "y";

  const siteName   = await ask("店舗名（例: ○○商店）");
  const ownerName  = await ask("オーナー名（例: 山田 太郎）", "");
  const ownerPhone = await ask("電話番号（例: 090-1234-5678）", "");
  const ownerEmail = await ask("メールアドレス", "");
  const address    = await ask("住所（例: 大阪府大阪市北区...）", "");
  const industryKey  = await ask("業種キー（food / cleaning / beauty / retail / other）", "other");
  const industryName = await ask("業種名（例: 飲食 / ハウスクリーニング）", industryKey);

  // 2. 確認表示
  console.log("\n──────────────────────────────────────");
  console.log("  登録内容の確認");
  console.log("──────────────────────────────────────");
  console.log(`  siteKey    : ${siteKey}`);
  console.log(`  ドメイン   : ${domain}${addWww ? `, www.${domain}` : ""}`);
  console.log(`  店舗名     : ${siteName}`);
  if (ownerName)  console.log(`  オーナー   : ${ownerName}`);
  if (ownerPhone) console.log(`  電話       : ${ownerPhone}`);
  if (ownerEmail) console.log(`  メール     : ${ownerEmail}`);
  if (address)    console.log(`  住所       : ${address}`);
  console.log(`  業種       : ${industryName} (${industryKey})`);
  console.log("\n  Firestore に書き込むドキュメント:");
  console.log(`    domains/${domain}`);
  if (addWww) console.log(`    domains/www.${domain}`);
  console.log(`    siteSettings/${siteKey}`);
  console.log(`    siteSettingsEditable/${siteKey}`);
  console.log("──────────────────────────────────────");

  const ok = await ask("\n登録しますか？ (y/n)", "y");
  if (ok !== "y") {
    console.log("キャンセルしました。");
    rl.close();
    return;
  }

  // 3. 書き込み
  const now = FieldValue.serverTimestamp();
  const domains = [domain, ...(addWww ? [`www.${domain}`] : [])];

  for (const d of domains) {
    const ref = db.collection("domains").doc(d);
    const snap = await ref.get();
    if (snap.exists) {
      console.log(`  ⚠  domains/${d} は既に存在します（スキップ）: siteKey=${snap.data()?.siteKey}`);
    } else {
      await ref.set({ siteKey });
      console.log(`  ✅ domains/${d} → { siteKey: "${siteKey}" }`);
    }
  }

  // siteSettings
  const settingsRef = db.collection("siteSettings").doc(siteKey);
  if ((await settingsRef.get()).exists) {
    console.log(`  ⚠  siteSettings/${siteKey} は既に存在します（スキップ）`);
  } else {
    const data = {
      siteKey,
      siteName,
      domain,
      industry: { key: industryKey, name: industryName },
      createdAt: now,
      updatedAt: now,
      setupMode: true,
      isFreePlan: true,
      ...(ownerName  && { ownerName }),
      ...(ownerPhone && { ownerPhone }),
      ...(ownerEmail && { ownerEmail }),
      ...(address    && { ownerAddress: address }),
    };
    await settingsRef.set(data);
    console.log(`  ✅ siteSettings/${siteKey}`);
  }

  // siteSettingsEditable（最小限の初期値）
  const editableRef = db.collection("siteSettingsEditable").doc(siteKey);
  if ((await editableRef.get()).exists) {
    console.log(`  ⚠  siteSettingsEditable/${siteKey} は既に存在します（スキップ）`);
  } else {
    await editableRef.set({
      siteKey,
      activeMenuKeys: ["products", "news", "hours"],
      visibleMenuKeys: ["products", "news", "hours"],
      createdAt: now,
    });
    console.log(`  ✅ siteSettingsEditable/${siteKey}`);
  }

  console.log("\n========================================");
  console.log("  完了！");
  console.log("========================================");
  console.log("\n次のステップ:");
  console.log(`  1. Vercel の pageit-platform → Domains → Add Existing`);
  console.log(`     → ${domain} を追加`);
  console.log(`  2. DNS が未設定の場合は Vercel の指示に従って A レコード / CNAME を設定`);
  console.log(`  3. https://${domain}/login からオーナーがログインして設定`);
  console.log("");

  rl.close();
}

main().catch((e) => {
  console.error(e);
  rl.close();
  process.exit(1);
});
