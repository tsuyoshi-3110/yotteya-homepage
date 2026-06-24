import test, { after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { deleteApp, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { syncAdminDomainStatus } from "../src/lib/customer-config/admin-domain-status-sync.ts";
import {
  createAdminDomainStatusSyncDependencies,
  createFirestoreDomainStatusSyncTransaction,
} from "../src/lib/customer-config/admin-domain-status-sync-firestore.ts";
import { VercelStatusUnavailableError } from "../src/lib/customer-config/vercel-domain-status.ts";

const projectId = process.env.GCLOUD_PROJECT;
const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;

if (projectId !== "demo-pageit-domain-emulator") {
  throw new Error(`unexpected emulator project: ${projectId ?? "missing"}`);
}
if (!emulatorHost || !/^(127\.0\.0\.1|localhost):\d+$/.test(emulatorHost)) {
  throw new Error(`Firestore Emulator is required: ${emulatorHost ?? "missing"}`);
}
if (
  process.env.FIREBASE_PRIVATE_KEY ||
  process.env.GOOGLE_APPLICATION_CREDENTIALS
) {
  throw new Error("production credentials must not be present in emulator tests");
}

const app = initializeApp({ projectId }, `domain-sync-emulator-${Date.now()}`);
const db = getFirestore(app);
db.settings({ ignoreUndefinedProperties: false });

const clearUrl =
  `http://${emulatorHost}/emulator/v1/projects/${projectId}` +
  "/databases/(default)/documents";

async function clearEmulator() {
  const response = await fetch(clearUrl, { method: "DELETE" });
  assert.equal(response.ok, true, await response.text());
}

async function seed(documents) {
  const batch = db.batch();
  for (const [path, data] of Object.entries(documents)) {
    batch.set(db.doc(path), data);
  }
  await batch.commit();
}

async function snapshot(paths) {
  const documents = await db.getAll(...paths.map((path) => db.doc(path)));
  return Object.fromEntries(
    documents.map((document, index) => [
      paths[index],
      document.exists ? document.data() : null,
    ]),
  );
}

function withoutSyncFields(site) {
  return Object.fromEntries(
    Object.entries(site).filter(
      ([key]) =>
        ![
          "domainStatus",
          "domainStatusCheckedAt",
          "domainStatusReason",
        ].includes(key),
    ),
  );
}

function rawHost(hostname, {
  verified = true,
  misconfigured = false,
  configuredBy = hostname.startsWith("www.") ? "CNAME" : "A",
  acceptedChallenges = ["dns-01", "http-01"],
} = {}) {
  return {
    projectDomain: {
      verified,
      redirect: null,
      verification: [],
    },
    config: {
      misconfigured,
      configuredBy,
      acceptedChallenges,
      recommendedIPv4: [{ rank: 1, value: ["216.198.79.1"] }],
      recommendedCNAME: [{ rank: 1, value: "example.vercel-dns.com" }],
    },
  };
}

function dependencies(fetchHostStatus = async (hostname) => rawHost(hostname)) {
  return createAdminDomainStatusSyncDependencies({
    firestore: db,
    fetchHostStatus,
  });
}

async function sync(syncDependencies = dependencies(), uid = "owner-1") {
  return syncAdminDomainStatus({
    siteKey: "yotteya",
    uid,
    dependencies: syncDependencies,
  });
}

const targetPaths = [
  "siteSettings/yotteya",
  "sites/yotteya",
  "domains/example.com",
  "domains/www.example.com",
];

async function seedReadySite(overrides = {}) {
  await seed({
    "siteSettings/yotteya": {
      ownerId: "owner-1",
      unknownOwnerField: "keep-owner",
    },
    "sites/yotteya": {
      config: { nested: { keep: true } },
      unknownSiteField: { keep: true },
      domain: "example.com",
      canonicalHost: "example.com",
      wwwEnabled: true,
      domainStatus: "pending_dns",
      updatedAt: "must-not-change",
      ...overrides,
    },
    "domains/example.com": {
      siteKey: "yotteya",
      unknownDomainField: "keep-apex",
    },
    "domains/www.example.com": {
      siteKey: "yotteya",
      unknownDomainField: "keep-www",
    },
  });
}

beforeEach(clearEmulator);

after(async () => {
  await clearEmulator();
  await db.terminate();
  await deleteApp(app);
});

test("active sync changes only the three allowed site fields and no registry document", async () => {
  await seedReadySite();
  const before = await snapshot(targetPaths);

  const result = await sync();
  const afterState = await snapshot(targetPaths);

  assert.equal(result.status, 200);
  assert.equal(result.body.domainStatus, "active");
  const {
    domainStatus,
    domainStatusReason,
    domainStatusCheckedAt,
  } = afterState["sites/yotteya"];
  assert.equal(domainStatus, "active");
  assert.equal(domainStatusReason, "vercel_required_hosts_ready");
  assert.ok(domainStatusCheckedAt instanceof Timestamp);
  assert.deepEqual(
    withoutSyncFields(afterState["sites/yotteya"]),
    withoutSyncFields(before["sites/yotteya"]),
  );
  assert.deepEqual(
    afterState["siteSettings/yotteya"],
    before["siteSettings/yotteya"],
  );
  assert.deepEqual(
    afterState["domains/example.com"],
    before["domains/example.com"],
  );
  assert.deepEqual(
    afterState["domains/www.example.com"],
    before["domains/www.example.com"],
  );
});

test("pending_dns and pending_ssl assessments are committed atomically", async () => {
  await seedReadySite();
  const pendingDnsResult = await sync(
    dependencies(async (hostname) =>
      rawHost(hostname, {
        verified: false,
        misconfigured: true,
        configuredBy: null,
      }),
    ),
  );
  assert.equal(pendingDnsResult.status, 200);
  assert.equal((await db.doc("sites/yotteya").get()).get("domainStatus"), "pending_dns");

  const pendingSslResult = await sync(
    dependencies(async (hostname) =>
      rawHost(hostname, { acceptedChallenges: [] }),
    ),
  );
  assert.equal(pendingSslResult.status, 200);
  assert.equal((await db.doc("sites/yotteya").get()).get("domainStatus"), "pending_ssl");
});

test("same status and reason still update only the checked time", async () => {
  const oldCheckedAt = Timestamp.fromMillis(1_700_000_000_000);
  await seedReadySite({
    domainStatus: "active",
    domainStatusReason: "vercel_required_hosts_ready",
    domainStatusCheckedAt: oldCheckedAt,
  });
  const before = await snapshot(targetPaths);

  const result = await sync();
  const afterState = await snapshot(targetPaths);

  assert.equal(result.status, 200);
  assert.equal(result.body.changed, false);
  assert.equal(afterState["sites/yotteya"].domainStatus, "active");
  assert.equal(
    afterState["sites/yotteya"].domainStatusReason,
    "vercel_required_hosts_ready",
  );
  assert.ok(
    afterState["sites/yotteya"].domainStatusCheckedAt.toMillis() >
      oldCheckedAt.toMillis(),
  );
  assert.deepEqual(
    afterState["domains/example.com"],
    before["domains/example.com"],
  );
  assert.deepEqual(
    afterState["domains/www.example.com"],
    before["domains/www.example.com"],
  );
});

test("owner mismatch and Vercel failure leave every target document unchanged", async () => {
  await seedReadySite();
  const before = await snapshot(targetPaths);

  const forbidden = await sync(dependencies(), "other-owner");
  assert.equal(forbidden.status, 403);
  assert.deepEqual(await snapshot(targetPaths), before);

  const unavailable = await sync(
    dependencies(async () => {
      throw new VercelStatusUnavailableError("timeout");
    }),
  );
  assert.equal(unavailable.status, 503);
  assert.deepEqual(await snapshot(targetPaths), before);
});

test("a concurrent domain setting change returns 409 without a sync write", async () => {
  await seedReadySite();
  let changed = false;
  const raceDependencies = dependencies(async (hostname) => {
    if (!changed) {
      changed = true;
      await db.doc("sites/yotteya").set({ wwwEnabled: false }, { merge: true });
    }
    return rawHost(hostname);
  });

  const result = await sync(raceDependencies);
  const afterState = await snapshot(targetPaths);

  assert.equal(result.status, 409);
  assert.equal(afterState["sites/yotteya"].wwwEnabled, false);
  assert.equal(afterState["sites/yotteya"].domainStatus, "pending_dns");
  assert.equal(afterState["sites/yotteya"].domainStatusCheckedAt, undefined);
  assert.equal(afterState["sites/yotteya"].domainStatusReason, undefined);
});

test("a Firestore failure after staging the status merge commits nothing", async () => {
  await seedReadySite();
  const before = await snapshot(targetPaths);
  const base = dependencies();
  const failingDependencies = {
    ...base,
    runTransaction: (operation) =>
      db.runTransaction(async (transaction) => {
        await operation(
          createFirestoreDomainStatusSyncTransaction(db, transaction),
        );
        throw new Error("simulated failure before commit");
      }),
  };

  const result = await sync(failingDependencies);

  assert.equal(result.status, 500);
  assert.deepEqual(await snapshot(targetPaths), before);
});

console.log(
  JSON.stringify({
    firestoreTarget: `http://${emulatorHost}`,
    projectId,
    credentials: "none",
    cleanup: "DELETE emulator documents after each test and at suite end",
    vercelTransport: "dependency-injected mock only",
  }),
);
