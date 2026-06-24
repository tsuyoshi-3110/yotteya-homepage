import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeManagedDomain,
  updateAdminDomainSettings,
} from "./admin-domain-update.ts";

function createAtomicDependencies({
  ownerId = "owner-1",
  site = {
    config: { companyName: "既存設定" },
    unknownSiteField: { keep: true },
  },
  domains = {},
  failBeforeCommit = false,
} = {}) {
  const store = {
    ownerId,
    site: structuredClone(site),
    domains: structuredClone(domains),
  };
  const writes = {
    site: 0,
    domains: 0,
  };

  return {
    store,
    writes,
    dependencies: {
      runTransaction: async (operation) => {
        const stagedSite = structuredClone(store.site);
        const stagedDomains = structuredClone(store.domains);
        const transaction = {
          readOwnerId: async () => store.ownerId,
          readSite: async () => structuredClone(store.site),
          readDomain: async (hostname) =>
            structuredClone(store.domains[hostname] ?? null),
          mergeSite: (_siteKey, patch) => {
            writes.site += 1;
            Object.assign(stagedSite, structuredClone(patch));
          },
          mergeDomain: (hostname, patch) => {
            writes.domains += 1;
            stagedDomains[hostname] = {
              ...(stagedDomains[hostname] ?? {}),
              ...structuredClone(patch),
            };
          },
        };

        const result = await operation(transaction);
        if (failBeforeCommit) throw new Error("firestore unavailable");
        store.site = stagedSite;
        store.domains = stagedDomains;
        return result;
      },
    },
  };
}

test("normalizes lowercase, a trailing dot, and an IDN hostname", () => {
  assert.deepEqual(normalizeManagedDomain("  EXAMPLE.COM.  "), {
    ok: true,
    hostname: "example.com",
  });
  assert.deepEqual(normalizeManagedDomain("例え.テスト"), {
    ok: true,
    hostname: "xn--r8jz45g.xn--zckzah",
  });
});

test("rejects protocols, paths, ports, localhost, IPs, vercel.app, and unsafe hosts", () => {
  for (const value of [
    "https://example.com",
    "example.com/path",
    "example.com:443",
    "localhost",
    "127.0.0.1",
    "[::1]",
    "tenant.vercel.app",
    "example.com?x=1",
    "example.com#x",
    "user@example.com",
    "-bad.example",
    "bad_.example",
    "www.example.com",
    "",
  ]) {
    assert.equal(
      normalizeManagedDomain(value).ok,
      false,
      `${value} must be rejected`,
    );
  }
});

test("saves a normalized domain with www enabled", async () => {
  const { store, dependencies } = createAtomicDependencies();
  const result = await updateAdminDomainSettings({
    siteKey: "yotteya",
    uid: "owner-1",
    input: { domain: "Example.COM.", wwwEnabled: true },
    dependencies,
  });

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    changed: true,
    siteKey: "yotteya",
    domain: "example.com",
    canonicalHost: "example.com",
    wwwEnabled: true,
    domainStatus: "pending_dns",
    domains: ["example.com", "www.example.com"],
  });
  assert.equal(store.site.domain, "example.com");
  assert.equal(store.site.canonicalHost, "example.com");
  assert.equal(store.site.wwwEnabled, true);
  assert.equal(store.site.domainStatus, "pending_dns");
  assert.equal(store.domains["example.com"].siteKey, "yotteya");
  assert.equal(store.domains["www.example.com"].siteKey, "yotteya");
});

test("same normalized domain and www value are a complete no-op", async () => {
  const { store, writes, dependencies } = createAtomicDependencies({
    site: {
      config: { companyName: "既存設定" },
      unknownSiteField: { keep: true },
      domain: "example.com",
      canonicalHost: "example.com",
      wwwEnabled: true,
      domainStatus: "active",
      updatedAt: "unchanged",
    },
    domains: {
      "example.com": {
        siteKey: "yotteya",
        domainStatus: "active",
        updatedAt: "unchanged-apex",
      },
      "www.example.com": {
        siteKey: "yotteya",
        domainStatus: "active",
        updatedAt: "unchanged-www",
      },
      "old.example": {
        siteKey: "yotteya",
        unknownDomainField: "keep-old",
      },
    },
  });
  const before = structuredClone(store);

  const result = await updateAdminDomainSettings({
    siteKey: "yotteya",
    uid: "owner-1",
    input: { domain: "  EXAMPLE.COM.  ", wwwEnabled: true },
    dependencies,
  });

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
  assert.deepEqual(store, before);
  assert.deepEqual(writes, { site: 0, domains: 0 });
});

test("owner verification is still required for a would-be no-op", async () => {
  const { store, writes, dependencies } = createAtomicDependencies({
    ownerId: "owner-1",
    site: {
      domain: "example.com",
      canonicalHost: "example.com",
      wwwEnabled: true,
      domainStatus: "active",
    },
  });
  const before = structuredClone(store);

  const result = await updateAdminDomainSettings({
    siteKey: "yotteya",
    uid: "owner-2",
    input: { domain: "example.com", wwwEnabled: true },
    dependencies,
  });

  assert.equal(result.status, 403);
  assert.deepEqual(store, before);
  assert.deepEqual(writes, { site: 0, domains: 0 });
});

test("changing only wwwEnabled performs the normal pending_dns update", async () => {
  const { store, writes, dependencies } = createAtomicDependencies({
    site: {
      domain: "example.com",
      canonicalHost: "example.com",
      wwwEnabled: false,
      domainStatus: "active",
      updatedAt: "keep",
    },
  });

  const result = await updateAdminDomainSettings({
    siteKey: "yotteya",
    uid: "owner-1",
    input: { domain: "example.com", wwwEnabled: true },
    dependencies,
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.changed, true);
  assert.equal(store.site.domainStatus, "pending_dns");
  assert.deepEqual(writes, { site: 1, domains: 2 });
});

test("changing the domain performs the normal pending_dns update", async () => {
  const { store, writes, dependencies } = createAtomicDependencies({
    site: {
      domain: "old.example",
      canonicalHost: "old.example",
      wwwEnabled: true,
      domainStatus: "active",
      updatedAt: "keep",
    },
  });

  const result = await updateAdminDomainSettings({
    siteKey: "yotteya",
    uid: "owner-1",
    input: { domain: "example.com", wwwEnabled: true },
    dependencies,
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.changed, true);
  assert.equal(store.site.domain, "example.com");
  assert.equal(store.site.domainStatus, "pending_dns");
  assert.deepEqual(writes, { site: 1, domains: 2 });
});

test("saves only the apex target when www is disabled and does not delete old registry entries", async () => {
  const { store, dependencies } = createAtomicDependencies({
    domains: {
      "www.old.example": {
        siteKey: "yotteya",
        unknownDomainField: "keep",
      },
    },
  });
  const result = await updateAdminDomainSettings({
    siteKey: "yotteya",
    uid: "owner-1",
    input: { domain: "example.com", wwwEnabled: false },
    dependencies,
  });

  assert.equal(result.status, 200);
  assert.equal(store.site.wwwEnabled, false);
  assert.ok(store.domains["example.com"]);
  assert.equal(store.domains["www.example.com"], undefined);
  assert.deepEqual(store.domains["www.old.example"], {
    siteKey: "yotteya",
    unknownDomainField: "keep",
  });
});

test("returns 400 for invalid input before starting a transaction", async () => {
  let transactions = 0;
  const result = await updateAdminDomainSettings({
    siteKey: "yotteya",
    uid: "owner-1",
    input: { domain: "https://example.com", wwwEnabled: true },
    dependencies: {
      runTransaction: async () => {
        transactions += 1;
        throw new Error("must not run");
      },
    },
  });

  assert.equal(result.status, 400);
  assert.equal(transactions, 0);
});

test("returns 401 before starting a transaction when unauthenticated", async () => {
  let transactions = 0;
  const result = await updateAdminDomainSettings({
    siteKey: "yotteya",
    uid: null,
    input: { domain: "example.com", wwwEnabled: true },
    dependencies: {
      runTransaction: async () => {
        transactions += 1;
        throw new Error("must not run");
      },
    },
  });

  assert.equal(result.status, 401);
  assert.equal(transactions, 0);
});

test("returns 403 without writes when the owner does not match", async () => {
  const { store, dependencies } = createAtomicDependencies({
    ownerId: "owner-1",
  });
  const before = structuredClone(store);
  const result = await updateAdminDomainSettings({
    siteKey: "yotteya",
    uid: "other-owner",
    input: { domain: "example.com", wwwEnabled: true },
    dependencies,
  });

  assert.equal(result.status, 403);
  assert.deepEqual(store, before);
});

test("returns 409 without writes when a target hostname belongs to another site", async () => {
  const { store, dependencies } = createAtomicDependencies({
    domains: {
      "www.example.com": {
        siteKey: "another-site",
        unknownDomainField: "keep",
      },
    },
  });
  const before = structuredClone(store);
  const result = await updateAdminDomainSettings({
    siteKey: "yotteya",
    uid: "owner-1",
    input: { domain: "example.com", wwwEnabled: true },
    dependencies,
  });

  assert.equal(result.status, 409);
  assert.deepEqual(store, before);
});

test("merge updates preserve config and unknown site/domain fields", async () => {
  const { store, dependencies } = createAtomicDependencies({
    site: {
      config: { companyName: "既存設定", nested: { keep: true } },
      unknownSiteField: { keep: true },
    },
    domains: {
      "example.com": {
        siteKey: "yotteya",
        unknownDomainField: { keep: true },
      },
    },
  });
  const result = await updateAdminDomainSettings({
    siteKey: "yotteya",
    uid: "owner-1",
    input: { domain: "example.com", wwwEnabled: false },
    dependencies,
  });

  assert.equal(result.status, 200);
  assert.deepEqual(store.site.config, {
    companyName: "既存設定",
    nested: { keep: true },
  });
  assert.deepEqual(store.site.unknownSiteField, { keep: true });
  assert.deepEqual(store.domains["example.com"].unknownDomainField, {
    keep: true,
  });
});

test("a transaction failure returns 500 and commits no partial updates", async () => {
  const { store, dependencies } = createAtomicDependencies({
    failBeforeCommit: true,
  });
  const before = structuredClone(store);
  const result = await updateAdminDomainSettings({
    siteKey: "yotteya",
    uid: "owner-1",
    input: { domain: "example.com", wwwEnabled: true },
    dependencies,
  });

  assert.equal(result.status, 500);
  assert.deepEqual(store, before);
});

test("a transaction conflict aborts without committing staged writes", async () => {
  const { store, dependencies } = createAtomicDependencies();
  const before = structuredClone(store);
  const originalRunTransaction = dependencies.runTransaction;
  dependencies.runTransaction = async (operation) => {
    await originalRunTransaction(async (transaction) => {
      await operation(transaction);
      const conflict = new Error("transaction aborted");
      conflict.code = 10;
      throw conflict;
    });
  };

  const result = await updateAdminDomainSettings({
    siteKey: "yotteya",
    uid: "owner-1",
    input: { domain: "example.com", wwwEnabled: true },
    dependencies,
  });

  assert.equal(result.status, 500);
  assert.deepEqual(store, before);
});
