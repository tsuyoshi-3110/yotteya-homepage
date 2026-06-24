import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { CUSTOMER } from "../src/config/customer.ts";
import {
  buildAdditionsPatch,
  buildMigrationPlan,
  summarizePlan,
  toBackupJsonValue,
  validateConfigValue,
} from "./lib/site-config-migration.mjs";

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");

function readOption(name, fallback) {
  const prefix = `${name}=`;
  const option = [...args].find((arg) => arg.startsWith(prefix));
  return option ? option.slice(prefix.length) : fallback;
}

const siteKey = readOption("--site-key", CUSTOMER.siteKey);
const confirmation = readOption("--confirm-site-key", "");
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backupDir = path.resolve(
  readOption("--backup-dir", path.join(scriptDir, "backups", "sites"))
);

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function createFirestore() {
  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId: requiredEnv("FIREBASE_PROJECT_ID"),
        clientEmail: requiredEnv("FIREBASE_CLIENT_EMAIL"),
        privateKey: requiredEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
      }),
    });
  }
  return getFirestore();
}

function printEntries(title, entries, render) {
  console.log(`\n${title} (${entries.length})`);
  if (entries.length === 0) {
    console.log("  なし");
    return;
  }
  for (const entry of entries) console.log(`  ${render(entry)}`);
}

function printPlan(plan) {
  printEntries("追加予定", plan.additions, ({ path: fieldPath, value }) =>
    `${fieldPath} = ${JSON.stringify(value)}`
  );
  printEntries("衝突（既存値を維持）", plan.conflicts, ({
    path: fieldPath,
    current,
    proposed,
    reason,
  }) => `${fieldPath}: ${reason}; existing=${JSON.stringify(current)} proposed=${JSON.stringify(proposed)}`);
  printEntries("変更なし", plan.unchanged, ({ path: fieldPath }) => fieldPath);
}

function timestampForFilename() {
  return new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

async function backupSnapshot(snapshot) {
  await mkdir(backupDir, { recursive: true });
  const backupPath = path.join(
    backupDir,
    `${siteKey}-${timestampForFilename()}.json`
  );
  const payload = {
    collection: "sites",
    documentId: siteKey,
    exists: snapshot.exists,
    readAt: new Date().toISOString(),
    data: snapshot.exists ? toBackupJsonValue(snapshot.data()) : null,
  };
  await writeFile(backupPath, `${JSON.stringify(payload, null, 2)}\n`, {
    flag: "wx",
  });
  return backupPath;
}

const sourceErrors = validateConfigValue(CUSTOMER, CUSTOMER);
if (sourceErrors.length > 0) {
  throw new Error(`customer.ts type validation failed:\n${sourceErrors.join("\n")}`);
}

if (siteKey !== CUSTOMER.siteKey) {
  throw new Error(
    `site key mismatch: requested=${siteKey}, customer.ts=${CUSTOMER.siteKey}`
  );
}

if (apply && confirmation !== siteKey) {
  throw new Error(
    `write blocked: --apply requires --confirm-site-key=${siteKey}`
  );
}

const firestore = createFirestore();
const targetRef = firestore.collection("sites").doc(siteKey);
const initialSnapshot = await targetRef.get();
const backupPath = await backupSnapshot(initialSnapshot);
const initialSnapshotValue = initialSnapshot.exists
  ? toBackupJsonValue(initialSnapshot.data())
  : null;
const initialPlan = buildMigrationPlan(
  initialSnapshot.exists ? initialSnapshot.data() : undefined,
  CUSTOMER
);

console.log(`mode: ${apply ? "APPLY" : "DRY-RUN"}`);
console.log(`target: sites/${siteKey}`);
console.log(`document exists: ${initialSnapshot.exists ? "yes" : "no"}`);
console.log(`layout: ${initialPlan.layout}`);
console.log(`backup: ${backupPath}`);
printPlan(initialPlan);
console.log("\nsummary:", summarizePlan(initialPlan));

if (!apply) {
  console.log("\nDRY-RUN完了: Firestoreへの書き込みは行っていません。");
  process.exit(0);
}

await firestore.runTransaction(async (transaction) => {
  const latestSnapshot = await transaction.get(targetRef);
  const latestPlan = buildMigrationPlan(
    latestSnapshot.exists ? latestSnapshot.data() : undefined,
    CUSTOMER
  );

  const latestSnapshotValue = latestSnapshot.exists
    ? toBackupJsonValue(latestSnapshot.data())
    : null;
  if (
    latestSnapshot.exists !== initialSnapshot.exists ||
    JSON.stringify(latestSnapshotValue) !== JSON.stringify(initialSnapshotValue)
  ) {
    throw new Error(
      "write blocked: target document changed after backup; rerun dry-run"
    );
  }

  if (JSON.stringify(latestPlan) !== JSON.stringify(initialPlan)) {
    throw new Error(
      "write blocked: target document changed after backup; rerun dry-run"
    );
  }

  const patch = buildAdditionsPatch(latestPlan);
  if (latestPlan.additions.length > 0) {
    transaction.set(targetRef, patch, { merge: true });
  }
});

console.log("\nAPPLY完了: 不足フィールドのみ追加しました。");
