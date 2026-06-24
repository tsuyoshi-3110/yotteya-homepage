import test, { after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { deleteApp, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { updateAdminDomainSettings } from "../src/lib/customer-config/admin-domain-update.ts";
import {
  createAdminDomainUpdateDependencies,
  createFirestoreDomainUpdateTransaction,
} from "../src/lib/customer-config/admin-domain-update-firestore.ts";

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

const app = initializeApp({ projectId }, `domain-emulator-${Date.now()}`);
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
    batch.set(db.doc(path), structuredClone(data));
  }
  await batch.commit();
}

async function snapshot(paths) {
  const refs = paths.map((path) => db.doc(path));
  const documents = await db.getAll(...refs);
  return Object.fromEntries(
    documents.map((document, index) => [
      paths[index],
      document.exists ? document.data() : null,
    ]),
  );
}

async function save({
  uid = "owner-1",
  domain = "example.com",
  wwwEnabled = true,
  dependencies = createAdminDomainUpdateDependencies(db),
} = {}) {
  return updateAdminDomainSettings({
    siteKey: "yotteya",
    uid,
    input: { domain, wwwEnabled },
    dependencies,
  });
}

beforeEach(clearEmulator);

after(async () => {
  await clearEmulator();
  await db.terminate();
  await deleteApp(app);
});

test("updates domain settings while preserving site config and unknown fields", async () => {
  const paths = [
    "siteSettings/yotteya",
    "sites/yotteya",
    "domains/example.com",
    "domains/www.example.com",
  ];
  await seed({
    "siteSettings/yotteya": {
      ownerId: "owner-1",
      unknownOwnerField: { keep: true },
    },
    "sites/yotteya": {
      config: {
        companyName: "既存顧客設定",
        nested: { keep: true },
      },
      unknownSiteField: { keep: true },
      domain: "old.example",
      canonicalHost: "old.example",
      wwwEnabled: false,
      domainStatus: "active",
    },
  });
  const before = await snapshot(paths);

  const result = await save({ domain: "Example.COM.", wwwEnabled: true });
  const afterState = await snapshot(paths);

  assert.equal(result.status, 200);
  assert.equal(result.body.changed, true);
  assert.deepEqual(afterState["sites/yotteya"].config, before["sites/yotteya"].config);
  assert.deepEqual(
    afterState["sites/yotteya"].unknownSiteField,
    before["sites/yotteya"].unknownSiteField,
  );
  assert.deepEqual(
    afterState["siteSettings/yotteya"],
    before["siteSettings/yotteya"],
  );
  assert.deepEqual(
    {
      domain: afterState["sites/yotteya"].domain,
      canonicalHost: afterState["sites/yotteya"].canonicalHost,
      wwwEnabled: afterState["sites/yotteya"].wwwEnabled,
      domainStatus: afterState["sites/yotteya"].domainStatus,
    },
    {
      domain: "example.com",
      canonicalHost: "example.com",
      wwwEnabled: true,
      domainStatus: "pending_dns",
    },
  );
  assert.deepEqual(afterState["domains/example.com"], {
    siteKey: "yotteya",
    domain: "example.com",
    canonicalHost: "example.com",
    wwwEnabled: true,
    domainStatus: "pending_dns",
  });
  assert.deepEqual(afterState["domains/www.example.com"], {
    siteKey: "yotteya",
    domain: "example.com",
    canonicalHost: "example.com",
    wwwEnabled: true,
    domainStatus: "pending_dns",
  });
});

test("wwwEnabled=false creates only the apex registry document", async () => {
  const paths = [
    "sites/yotteya",
    "domains/example.com",
    "domains/www.example.com",
  ];
  await seed({
    "siteSettings/yotteya": { ownerId: "owner-1" },
    "sites/yotteya": { config: { keep: true } },
  });
  const before = await snapshot(paths);

  const result = await save({ wwwEnabled: false });
  const afterState = await snapshot(paths);

  assert.equal(result.status, 200);
  assert.equal(before["domains/example.com"], null);
  assert.equal(before["domains/www.example.com"], null);
  assert.equal(afterState["domains/example.com"].siteKey, "yotteya");
  assert.equal(afterState["domains/www.example.com"], null);
  assert.deepEqual(afterState["sites/yotteya"].config, { keep: true });
});

test("same normalized settings are a no-op and preserve active status and timestamps", async () => {
  const paths = [
    "siteSettings/yotteya",
    "sites/yotteya",
    "domains/example.com",
    "domains/www.example.com",
    "domains/old.example",
  ];
  await seed({
    "siteSettings/yotteya": {
      ownerId: "owner-1",
      unknownOwnerField: "keep",
    },
    "sites/yotteya": {
      config: { nested: { keep: true } },
      unknownSiteField: { keep: true },
      domain: "example.com",
      canonicalHost: "example.com",
      wwwEnabled: true,
      domainStatus: "active",
      updatedAt: "site-timestamp-must-not-change",
    },
    "domains/example.com": {
      siteKey: "yotteya",
      domain: "example.com",
      domainStatus: "active",
      updatedAt: "apex-timestamp-must-not-change",
      unknownDomainField: "keep-apex",
    },
    "domains/www.example.com": {
      siteKey: "yotteya",
      domain: "example.com",
      domainStatus: "active",
      updatedAt: "www-timestamp-must-not-change",
      unknownDomainField: "keep-www",
    },
    "domains/old.example": {
      siteKey: "yotteya",
      unknownDomainField: "keep-old",
    },
  });
  const before = await snapshot(paths);

  const result = await save({
    domain: "  EXAMPLE.COM.  ",
    wwwEnabled: true,
  });
  const afterState = await snapshot(paths);

  assert.deepEqual(result, {
    status: 200,
    body: {
      changed: false,
      siteKey: "yotteya",
      domain: "example.com",
      canonicalHost: "example.com",
      wwwEnabled: true,
      domainStatus: "active",
      domains: ["example.com", "www.example.com"],
    },
  });
  assert.deepEqual(afterState, before);
});

test("changing only wwwEnabled performs a normal update", async () => {
  const paths = [
    "sites/yotteya",
    "domains/example.com",
    "domains/www.example.com",
  ];
  await seed({
    "siteSettings/yotteya": { ownerId: "owner-1" },
    "sites/yotteya": {
      config: { keep: true },
      domain: "example.com",
      canonicalHost: "example.com",
      wwwEnabled: false,
      domainStatus: "active",
      updatedAt: "preserved-unknown-write-field",
    },
  });

  const result = await save({ domain: "example.com", wwwEnabled: true });
  const afterState = await snapshot(paths);

  assert.equal(result.status, 200);
  assert.equal(result.body.changed, true);
  assert.equal(afterState["sites/yotteya"].domainStatus, "pending_dns");
  assert.equal(afterState["sites/yotteya"].updatedAt, "preserved-unknown-write-field");
  assert.equal(afterState["domains/example.com"].siteKey, "yotteya");
  assert.equal(afterState["domains/www.example.com"].siteKey, "yotteya");
});

test("changing the domain performs a normal update", async () => {
  const paths = [
    "sites/yotteya",
    "domains/example.com",
    "domains/www.example.com",
    "domains/old.example",
  ];
  await seed({
    "siteSettings/yotteya": { ownerId: "owner-1" },
    "sites/yotteya": {
      config: { keep: true },
      domain: "old.example",
      canonicalHost: "old.example",
      wwwEnabled: true,
      domainStatus: "active",
    },
    "domains/old.example": {
      siteKey: "yotteya",
      unknownDomainField: "keep-old",
    },
  });
  const before = await snapshot(paths);

  const result = await save({ domain: "example.com", wwwEnabled: true });
  const afterState = await snapshot(paths);

  assert.equal(result.status, 200);
  assert.equal(result.body.changed, true);
  assert.equal(afterState["sites/yotteya"].domain, "example.com");
  assert.equal(afterState["sites/yotteya"].domainStatus, "pending_dns");
  assert.deepEqual(afterState["domains/old.example"], before["domains/old.example"]);
});

test("another site assignment returns 409 and aborts every target write", async () => {
  const paths = [
    "siteSettings/yotteya",
    "sites/yotteya",
    "domains/example.com",
    "domains/www.example.com",
  ];
  await seed({
    "siteSettings/yotteya": { ownerId: "owner-1", keep: true },
    "sites/yotteya": {
      config: { keep: true },
      domain: "old.example",
      unknownSiteField: "keep",
    },
    "domains/www.example.com": {
      siteKey: "another-site",
      unknownDomainField: "keep",
    },
  });
  const before = await snapshot(paths);

  const result = await save();
  const afterState = await snapshot(paths);

  assert.equal(result.status, 409);
  assert.deepEqual(afterState, before);
});

test("owner mismatch returns 403 and aborts every target write", async () => {
  const paths = [
    "siteSettings/yotteya",
    "sites/yotteya",
    "domains/example.com",
    "domains/www.example.com",
  ];
  await seed({
    "siteSettings/yotteya": { ownerId: "owner-1", keep: true },
    "sites/yotteya": { config: { keep: true }, unknownSiteField: "keep" },
    "domains/example.com": { unknownDomainField: "keep" },
  });
  const before = await snapshot(paths);

  const result = await save({ uid: "owner-2" });
  const afterState = await snapshot(paths);

  assert.equal(result.status, 403);
  assert.deepEqual(afterState, before);
});

test("a Firestore transaction precondition conflict commits none of the API writes", async () => {
  const paths = [
    "siteSettings/yotteya",
    "sites/yotteya",
    "domains/example.com",
    "domains/www.example.com",
    "conflictGuards/domain-save",
  ];
  await seed({
    "siteSettings/yotteya": { ownerId: "owner-1" },
    "sites/yotteya": {
      config: { keep: true },
      domain: "old.example",
      canonicalHost: "old.example",
      wwwEnabled: false,
      domainStatus: "active",
    },
    "conflictGuards/domain-save": {
      version: 1,
      unknownGuardField: "keep",
    },
  });
  const staleGuardSnapshot = await db.doc("conflictGuards/domain-save").get();
  await db.doc("conflictGuards/domain-save").set(
    { version: 2 },
    { merge: true },
  );
  const before = await snapshot(paths);

  const dependencies = {
    runTransaction: (operation) =>
      db.runTransaction(
        async (transaction) => {
          const result = await operation(
            createFirestoreDomainUpdateTransaction(db, transaction),
          );
          transaction.update(
            db.doc("conflictGuards/domain-save"),
            { attemptedByDomainSave: true },
            { lastUpdateTime: staleGuardSnapshot.updateTime },
          );
          return result;
        },
        { maxAttempts: 1 },
      ),
  };

  const result = await save({ dependencies });
  const afterState = await snapshot(paths);

  assert.equal(result.status, 500);
  assert.deepEqual(afterState, before);
  assert.equal(
    afterState["conflictGuards/domain-save"].attemptedByDomainSave,
    undefined,
  );
});

test("a Firestore failure after staging writes changes none of the three documents", async () => {
  const paths = [
    "sites/yotteya",
    "domains/example.com",
    "domains/www.example.com",
  ];
  await seed({
    "siteSettings/yotteya": { ownerId: "owner-1" },
    "sites/yotteya": {
      config: { keep: true },
      domain: "old.example",
      unknownSiteField: "keep",
    },
    "domains/example.com": {
      siteKey: "yotteya",
      domain: "old.example",
      unknownDomainField: "keep-apex",
    },
    "domains/www.example.com": {
      siteKey: "yotteya",
      domain: "old.example",
      unknownDomainField: "keep-www",
    },
  });
  const before = await snapshot(paths);
  const dependencies = {
    runTransaction: (operation) =>
      db.runTransaction(async (transaction) => {
        await operation(
          createFirestoreDomainUpdateTransaction(db, transaction),
        );
        throw new Error("simulated Firestore failure before commit");
      }),
  };

  const result = await save({ dependencies });
  const afterState = await snapshot(paths);

  assert.equal(result.status, 500);
  assert.deepEqual(afterState, before);
});

test("old domain registry documents are never deleted", async () => {
  const paths = [
    "domains/old.example",
    "domains/www.old.example",
    "domains/example.com",
    "domains/www.example.com",
  ];
  await seed({
    "siteSettings/yotteya": { ownerId: "owner-1" },
    "sites/yotteya": { config: { keep: true }, domain: "old.example" },
    "domains/old.example": {
      siteKey: "yotteya",
      unknownDomainField: "old-apex",
    },
    "domains/www.old.example": {
      siteKey: "yotteya",
      unknownDomainField: "old-www",
    },
  });
  const before = await snapshot(paths);

  const result = await save();
  const afterState = await snapshot(paths);

  assert.equal(result.status, 200);
  assert.deepEqual(afterState["domains/old.example"], before["domains/old.example"]);
  assert.deepEqual(
    afterState["domains/www.old.example"],
    before["domains/www.old.example"],
  );
  assert.equal(afterState["domains/example.com"].siteKey, "yotteya");
  assert.equal(afterState["domains/www.example.com"].siteKey, "yotteya");
});

test("repeated saves are idempotent for config and unknown fields", async () => {
  const paths = [
    "siteSettings/yotteya",
    "sites/yotteya",
    "domains/example.com",
    "domains/www.example.com",
  ];
  await seed({
    "siteSettings/yotteya": {
      ownerId: "owner-1",
      unknownOwnerField: "keep",
    },
    "sites/yotteya": {
      config: { nested: { keep: true } },
      unknownSiteField: { keep: true },
    },
    "domains/example.com": {
      siteKey: "yotteya",
      unknownDomainField: { keep: "apex" },
    },
    "domains/www.example.com": {
      siteKey: "yotteya",
      unknownDomainField: { keep: "www" },
    },
  });
  const before = await snapshot(paths);

  assert.equal((await save()).status, 200);
  const first = await snapshot(paths);
  const secondResult = await save();
  assert.equal(secondResult.status, 200);
  assert.equal(secondResult.body.changed, false);
  const second = await snapshot(paths);

  assert.deepEqual(second, first);
  assert.deepEqual(second["sites/yotteya"].config, before["sites/yotteya"].config);
  assert.deepEqual(
    second["sites/yotteya"].unknownSiteField,
    before["sites/yotteya"].unknownSiteField,
  );
  assert.deepEqual(
    second["domains/example.com"].unknownDomainField,
    before["domains/example.com"].unknownDomainField,
  );
  assert.deepEqual(
    second["domains/www.example.com"].unknownDomainField,
    before["domains/www.example.com"].unknownDomainField,
  );
  assert.deepEqual(
    second["siteSettings/yotteya"],
    before["siteSettings/yotteya"],
  );
});

console.log(
  JSON.stringify({
    firestoreTarget: `http://${emulatorHost}`,
    projectId,
    credentials: "none",
    cleanup: "DELETE emulator documents after each test and at suite end",
  }),
);
