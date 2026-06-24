import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { CUSTOMER } from "../src/config/customer.ts";
import {
  buildDomainDocumentPatch,
  buildDomainRegistryPlan,
  DOMAIN_REGISTRY_SETTINGS,
  DOMAIN_REGISTRY_TARGETS,
  hasSiteKeyConflict,
  summarizeDomainRegistryPlan,
} from "./lib/domain-registry-migration.mjs";
import { toBackupJsonValue } from "./lib/site-config-migration.mjs";

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");

function readOption(name, fallback) {
  const prefix = `${name}=`;
  const option = [...args].find((arg) => arg.startsWith(prefix));
  return option ? option.slice(prefix.length) : fallback;
}

const confirmationSiteKey = readOption("--confirm-site-key", "");
const confirmationDomain = readOption("--confirm-domain", "");
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backupDir = path.resolve(
  readOption(
    "--backup-dir",
    path.join(scriptDir, "backups", "domain-registry")
  )
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

function referenceForPath(firestore, documentPath) {
  const [collection, documentId] = documentPath.split("/");
  return firestore.collection(collection).doc(documentId);
}

function snapshotValue(snapshot) {
  return snapshot.exists ? toBackupJsonValue(snapshot.data()) : null;
}

function timestampForFilename() {
  return new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

async function writeBackup(snapshots) {
  await mkdir(backupDir, { recursive: true });
  const backupPath = path.join(
    backupDir,
    `yotteya-domains-${timestampForFilename()}.json`
  );
  const payload = {
    siteKey: DOMAIN_REGISTRY_SETTINGS.siteKey,
    canonicalHost: DOMAIN_REGISTRY_SETTINGS.canonicalHost,
    readAt: new Date().toISOString(),
    documents: Object.fromEntries(
      snapshots.map(({ documentPath, snapshot }) => [
        documentPath,
        {
          exists: snapshot.exists,
          data: snapshotValue(snapshot),
        },
      ])
    ),
  };
  await writeFile(backupPath, `${JSON.stringify(payload, null, 2)}\n`, {
    flag: "wx",
  });
  return backupPath;
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
  console.log("\n対象パス");
  for (const target of plan.targets) console.log(`  ${target.documentPath}`);

  printEntries("追加予定", plan.additions, ({ path: fieldPath, value }) =>
    `${fieldPath} = ${JSON.stringify(value)}`
  );
  printEntries("変更なし", plan.unchanged, ({ path: fieldPath }) => fieldPath);
  printEntries("衝突（既存値を維持）", plan.conflicts, ({
    path: fieldPath,
    current,
    proposed,
    reason,
  }) =>
    `${fieldPath}: ${reason}; existing=${JSON.stringify(current)} proposed=${JSON.stringify(proposed)}`
  );
}

if (CUSTOMER.siteKey !== DOMAIN_REGISTRY_SETTINGS.siteKey) {
  throw new Error("customer.ts siteKey does not match migration settings");
}

if (
  apply &&
  (confirmationSiteKey !== DOMAIN_REGISTRY_SETTINGS.siteKey ||
    confirmationDomain !== DOMAIN_REGISTRY_SETTINGS.canonicalHost)
) {
  throw new Error(
    "write blocked: --apply requires --confirm-site-key=yotteya and --confirm-domain=yotteya.shop"
  );
}

const firestore = createFirestore();
const refs = DOMAIN_REGISTRY_TARGETS.map((documentPath) => ({
  documentPath,
  ref: referenceForPath(firestore, documentPath),
}));
const snapshots = await Promise.all(
  refs.map(async ({ documentPath, ref }) => ({
    documentPath,
    ref,
    snapshot: await ref.get(),
  }))
);
const backupPath = await writeBackup(snapshots);
const initialDocuments = Object.fromEntries(
  snapshots.map(({ documentPath, snapshot }) => [
    documentPath,
    snapshot.exists ? snapshot.data() : undefined,
  ])
);
const initialValues = Object.fromEntries(
  snapshots.map(({ documentPath, snapshot }) => [
    documentPath,
    {
      exists: snapshot.exists,
      data: snapshotValue(snapshot),
    },
  ])
);
const initialPlan = buildDomainRegistryPlan(initialDocuments);

console.log(`mode: ${apply ? "APPLY" : "DRY-RUN"}`);
console.log(`backup: ${backupPath}`);
console.log(
  "redirect design: www.yotteya.shop -> yotteya.shop (redirect implementation is not included)"
);
printPlan(initialPlan);
console.log("\nsummary:", summarizeDomainRegistryPlan(initialPlan));

if (hasSiteKeyConflict(initialPlan)) {
  console.log("\n中止: 別siteKeyの登録を検出しました。書き込みは許可されません。");
  process.exitCode = 2;
} else if (initialPlan.conflicts.length > 0) {
  console.log("\n中止: 既存値との衝突を検出しました。書き込みは許可されません。");
  process.exitCode = 2;
} else if (!apply) {
  console.log("\nDRY-RUN完了: Firestoreへの書き込みは行っていません。");
} else {
  await firestore.runTransaction(async (transaction) => {
    const latestSnapshots = [];
    for (const { documentPath, ref } of refs) {
      latestSnapshots.push({
        documentPath,
        ref,
        snapshot: await transaction.get(ref),
      });
    }

    const latestValues = Object.fromEntries(
      latestSnapshots.map(({ documentPath, snapshot }) => [
        documentPath,
        {
          exists: snapshot.exists,
          data: snapshotValue(snapshot),
        },
      ])
    );
    if (JSON.stringify(latestValues) !== JSON.stringify(initialValues)) {
      throw new Error(
        "write blocked: target documents changed after backup; rerun dry-run"
      );
    }

    const latestDocuments = Object.fromEntries(
      latestSnapshots.map(({ documentPath, snapshot }) => [
        documentPath,
        snapshot.exists ? snapshot.data() : undefined,
      ])
    );
    const latestPlan = buildDomainRegistryPlan(latestDocuments);
    if (
      latestPlan.conflicts.length > 0 ||
      JSON.stringify(latestPlan) !== JSON.stringify(initialPlan)
    ) {
      throw new Error(
        "write blocked: migration plan changed inside transaction; rerun dry-run"
      );
    }

    for (const target of latestPlan.targets) {
      if (target.additions.length === 0) continue;
      const ref = referenceForPath(firestore, target.documentPath);
      transaction.set(ref, buildDomainDocumentPatch(target), { merge: true });
    }
  });

  console.log("\nAPPLY完了: 不足フィールドのみ追加しました。");
}
