import test from "node:test";
import assert from "node:assert/strict";
import { syncAdminDomainStatus } from "./admin-domain-status-sync.ts";
import { VercelStatusUnavailableError } from "./vercel-domain-status.ts";

function rawHost(hostname, {
  verified = true,
  misconfigured = false,
  configuredBy = hostname.startsWith("www.") ? "CNAME" : "A",
  acceptedChallenges = ["dns-01", "http-01"],
  redirect = null,
} = {}) {
  return {
    projectDomain: {
      verified,
      redirect,
      verification: verified ? [] : [{ type: "TXT", domain: hostname, value: "verify" }],
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

function createDependencies({
  ownerId = "owner-1",
  site = {
    config: { companyName: "既存設定" },
    unknownSiteField: { keep: true },
    domain: "example.com",
    canonicalHost: "example.com",
    wwwEnabled: true,
    domainStatus: "pending_dns",
  },
  fetchHostStatus = async (hostname) => rawHost(hostname),
  beforeTransaction,
  failBeforeCommit = false,
} = {}) {
  const store = {
    ownerId,
    site: structuredClone(site),
    domains: {
      "example.com": { siteKey: "yotteya", unknown: "keep-apex" },
      "www.example.com": { siteKey: "yotteya", unknown: "keep-www" },
    },
  };
  const writes = [];
  let checkedAtSequence = 0;

  return {
    store,
    writes,
    dependencies: {
      readOwnerId: async () => store.ownerId,
      readSite: async () => structuredClone(store.site),
      fetchHostStatus,
      checkedAtValue: () => ({ serverTimestamp: ++checkedAtSequence }),
      runTransaction: async (operation) => {
        await beforeTransaction?.(store);
        const stagedSite = structuredClone(store.site);
        const stagedWrites = [];
        const result = await operation({
          readOwnerId: async () => store.ownerId,
          readSite: async () => structuredClone(store.site),
          mergeSite: (_siteKey, patch) => {
            stagedWrites.push(structuredClone(patch));
            Object.assign(stagedSite, structuredClone(patch));
          },
        });
        if (failBeforeCommit) throw new Error("firestore unavailable");
        store.site = stagedSite;
        writes.push(...stagedWrites);
        return result;
      },
    },
  };
}

async function sync(dependencies, uid = "owner-1") {
  return syncAdminDomainStatus({
    siteKey: "yotteya",
    uid,
    dependencies,
  });
}

test("active sync writes only the three allowed fields and preserves all other data", async () => {
  const { store, writes, dependencies } = createDependencies();
  const before = structuredClone(store);

  const result = await sync(dependencies);

  assert.equal(result.status, 200);
  assert.equal(result.body.domainStatus, "active");
  assert.deepEqual(Object.keys(writes[0]).sort(), [
    "domainStatus",
    "domainStatusCheckedAt",
    "domainStatusReason",
  ]);
  assert.equal(store.site.domainStatus, "active");
  assert.equal(store.site.domainStatusReason, "vercel_required_hosts_ready");
  assert.deepEqual(store.site.config, before.site.config);
  assert.deepEqual(store.site.unknownSiteField, before.site.unknownSiteField);
  assert.deepEqual(store.domains, before.domains);
});

test("pending_dns is synchronized from verification or DNS waiting", async () => {
  const { store, dependencies } = createDependencies({
    fetchHostStatus: async (hostname) =>
      rawHost(hostname, { verified: false, misconfigured: true, configuredBy: null }),
  });

  const result = await sync(dependencies);

  assert.equal(result.status, 200);
  assert.equal(store.site.domainStatus, "pending_dns");
  assert.equal(
    store.site.domainStatusReason,
    "vercel_dns_or_verification_pending",
  );
});

test("pending_ssl is synchronized only after DNS and verification are ready", async () => {
  const { store, dependencies } = createDependencies({
    fetchHostStatus: async (hostname) =>
      rawHost(hostname, { acceptedChallenges: [] }),
  });

  const result = await sync(dependencies);

  assert.equal(result.status, 200);
  assert.equal(store.site.domainStatus, "pending_ssl");
  assert.equal(store.site.domainStatusReason, "vercel_ssl_pending");
});

test("same status and reason still refresh checkedAt while changed remains false", async () => {
  const { store, writes, dependencies } = createDependencies({
    site: {
      domain: "example.com",
      canonicalHost: "example.com",
      wwwEnabled: true,
      domainStatus: "active",
      domainStatusReason: "vercel_required_hosts_ready",
      domainStatusCheckedAt: "old-time",
      config: { keep: true },
    },
  });

  const result = await sync(dependencies);

  assert.equal(result.status, 200);
  assert.equal(result.body.changed, false);
  assert.equal(result.body.checkedAtUpdated, true);
  assert.deepEqual(writes[0].domainStatusCheckedAt, { serverTimestamp: 1 });
  assert.deepEqual(store.site.config, { keep: true });
});

test("wwwEnabled=false excludes www from the active requirement", async () => {
  const { store, dependencies } = createDependencies({
    site: {
      domain: "example.com",
      canonicalHost: "example.com",
      wwwEnabled: false,
      domainStatus: "pending_dns",
    },
    fetchHostStatus: async (hostname) =>
      hostname.startsWith("www.")
        ? rawHost(hostname, { verified: false, misconfigured: true, configuredBy: null })
        : rawHost(hostname),
  });

  const result = await sync(dependencies);

  assert.equal(result.status, 200);
  assert.equal(store.site.domainStatus, "active");
});

test("owner mismatch returns 403 without Vercel calls or writes", async () => {
  let vercelCalls = 0;
  const { store, writes, dependencies } = createDependencies({
    fetchHostStatus: async (hostname) => {
      vercelCalls += 1;
      return rawHost(hostname);
    },
  });
  const before = structuredClone(store);

  const result = await sync(dependencies, "other-owner");

  assert.equal(result.status, 403);
  assert.equal(vercelCalls, 0);
  assert.deepEqual(writes, []);
  assert.deepEqual(store, before);
});

test("Vercel failure and rate limiting leave Firestore unchanged", async () => {
  for (const [reason, expectedStatus] of [
    ["timeout", 503],
    ["upstream-429", 429],
  ]) {
    const { store, writes, dependencies } = createDependencies({
      fetchHostStatus: async () => {
        throw new VercelStatusUnavailableError(reason);
      },
    });
    const before = structuredClone(store);

    const result = await sync(dependencies);

    assert.equal(result.status, expectedStatus);
    assert.deepEqual(writes, []);
    assert.deepEqual(store, before);
  }
});

test("domain settings changed before the transaction returns 409 with no sync write", async () => {
  const { store, writes, dependencies } = createDependencies({
    beforeTransaction: async (current) => {
      current.site.wwwEnabled = false;
    },
  });

  const result = await sync(dependencies);

  assert.equal(result.status, 409);
  assert.deepEqual(writes, []);
  assert.equal(store.site.domainStatus, "pending_dns");
});

test("a Firestore failure after staging the sync commits no fields", async () => {
  const { store, writes, dependencies } = createDependencies({
    failBeforeCommit: true,
  });
  const before = structuredClone(store);

  const result = await sync(dependencies);

  assert.equal(result.status, 500);
  assert.deepEqual(writes, []);
  assert.deepEqual(store, before);
});
