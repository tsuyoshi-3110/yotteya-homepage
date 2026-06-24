import test from "node:test";
import assert from "node:assert/strict";
import {
  authenticateAdminDomainRequest,
  DOMAIN_DNS_REFERENCE,
  getAdminDomainSettings,
  isValidAdminSiteKey,
} from "./admin-domain-settings.ts";

function dependencies({
  ownerId = "owner-1",
  site = {
    domain: "yotteya.shop",
    canonicalHost: "yotteya.shop",
    wwwEnabled: true,
    domainStatus: "active",
  },
  domains = [
    {
      id: "yotteya.shop",
      data: {
        siteKey: "yotteya",
        domain: "yotteya.shop",
        canonicalHost: "yotteya.shop",
        wwwEnabled: true,
        domainStatus: "active",
      },
    },
    {
      id: "www.yotteya.shop",
      data: {
        siteKey: "yotteya",
        domain: "yotteya.shop",
        canonicalHost: "yotteya.shop",
        wwwEnabled: true,
        domainStatus: "active",
      },
    },
  ],
} = {}) {
  return {
    readOwnerId: async () => ownerId,
    readSite: async () => site,
    readDomains: async () => domains,
  };
}

test("authentication is required before Firestore reads", async () => {
  let reads = 0;
  const result = await getAdminDomainSettings({
    siteKey: "yotteya",
    uid: null,
    dependencies: {
      readOwnerId: async () => {
        reads += 1;
        return "owner-1";
      },
      readSite: async () => {
        reads += 1;
        return null;
      },
      readDomains: async () => {
        reads += 1;
        return [];
      },
    },
  });

  assert.equal(result.status, 401);
  assert.equal(reads, 0);
});

test("Firebase Bearer ID token is preferred for authentication", async () => {
  const calls = [];
  const uid = await authenticateAdminDomainRequest({
    authorization: "Bearer id-token",
    session: "session-cookie",
    dependencies: {
      verifyIdToken: async (token) => {
        calls.push(`id:${token}`);
        return { uid: "bearer-owner" };
      },
      verifySessionCookie: async (session) => {
        calls.push(`session:${session}`);
        return { uid: "session-owner" };
      },
    },
  });

  assert.equal(uid, "bearer-owner");
  assert.deepEqual(calls, ["id:id-token"]);
});

test("existing session cookie is used when Bearer token is absent", async () => {
  const uid = await authenticateAdminDomainRequest({
    authorization: null,
    session: "session-cookie",
    dependencies: {
      verifyIdToken: async () => {
        throw new Error("must not be called");
      },
      verifySessionCookie: async (session) => {
        assert.equal(session, "session-cookie");
        return { uid: "session-owner" };
      },
    },
  });

  assert.equal(uid, "session-owner");
});

test("invalid Firebase credentials return unauthenticated", async () => {
  const uid = await authenticateAdminDomainRequest({
    authorization: "Bearer invalid",
    session: null,
    dependencies: {
      verifyIdToken: async () => {
        throw new Error("invalid token");
      },
      verifySessionCookie: async () => ({ uid: "unexpected" }),
    },
  });

  assert.equal(uid, null);
});

test("siteKey format is validated before Firestore reads", async () => {
  for (const siteKey of ["../yotteya", "yotteya/shop", "", "a".repeat(129)]) {
    let reads = 0;
    const result = await getAdminDomainSettings({
      siteKey,
      uid: "owner-1",
      dependencies: {
        readOwnerId: async () => {
          reads += 1;
          return "owner-1";
        },
        readSite: async () => null,
        readDomains: async () => [],
      },
    });

    assert.equal(result.status, 400);
    assert.equal(reads, 0);
  }
  assert.equal(isValidAdminSiteKey("tenant_01-example"), true);
});

test("ownerId must match the authenticated uid", async () => {
  let protectedReads = 0;
  const result = await getAdminDomainSettings({
    siteKey: "yotteya",
    uid: "other-owner",
    dependencies: {
      readOwnerId: async () => "owner-1",
      readSite: async () => {
        protectedReads += 1;
        return {};
      },
      readDomains: async () => {
        protectedReads += 1;
        return [];
      },
    },
  });

  assert.equal(result.status, 403);
  assert.equal(protectedReads, 0);
});

test("the owner receives site settings, related domains, and DNS display values", async () => {
  const result = await getAdminDomainSettings({
    siteKey: "yotteya",
    uid: "owner-1",
    dependencies: dependencies(),
  });

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    siteKey: "yotteya",
    domain: "yotteya.shop",
    canonicalHost: "yotteya.shop",
    wwwEnabled: true,
    domainStatus: "active",
    domains: [
      {
        hostname: "yotteya.shop",
        siteKey: "yotteya",
        domain: "yotteya.shop",
        canonicalHost: "yotteya.shop",
        wwwEnabled: true,
        domainStatus: "active",
      },
      {
        hostname: "www.yotteya.shop",
        siteKey: "yotteya",
        domain: "yotteya.shop",
        canonicalHost: "yotteya.shop",
        wwwEnabled: true,
        domainStatus: "active",
      },
    ],
    dns: DOMAIN_DNS_REFERENCE,
  });
  assert.equal(result.body.dns.notice, "現在のyotteya.shopで確認した値");
});

test("unset domain settings return 404", async () => {
  const result = await getAdminDomainSettings({
    siteKey: "yotteya",
    uid: "owner-1",
    dependencies: dependencies({ site: { config: {} }, domains: [] }),
  });

  assert.equal(result.status, 404);
  assert.deepEqual(result.body, { error: "domain-settings-not-found" });
});

test("another site's authenticated owner cannot access this site", async () => {
  const result = await getAdminDomainSettings({
    siteKey: "yotteya",
    uid: "owner-of-another-site",
    dependencies: dependencies({ ownerId: "yotteya-owner" }),
  });

  assert.equal(result.status, 403);
  assert.deepEqual(result.body, { error: "forbidden" });
});
