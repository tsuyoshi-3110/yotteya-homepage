import test from "node:test";
import assert from "node:assert/strict";
import {
  getAdminVercelDomainStatus,
  normalizeVercelHostStatus,
  VercelStatusUnavailableError,
} from "./vercel-domain-status.ts";

function dependencies({
  ownerId = "owner-1",
  site = {
    domain: "example.com",
    wwwEnabled: true,
  },
  fetchHostStatus = async (hostname) => ({
    projectDomain: {
      name: hostname,
      apexName: "example.com",
      verified: true,
      redirect: null,
      redirectStatusCode: null,
      verification: [],
    },
    config: {
      configuredBy: hostname.startsWith("www.") ? "CNAME" : "A",
      acceptedChallenges: ["dns-01", "http-01"],
      recommendedIPv4: [{ rank: 1, value: ["216.198.79.1"] }],
      recommendedCNAME: [
        { rank: 1, value: "example.vercel-dns.com" },
      ],
      misconfigured: false,
    },
  }),
} = {}) {
  return {
    readOwnerId: async () => ownerId,
    readSite: async () => site,
    fetchHostStatus,
  };
}

test("authentication is required before Firestore or Vercel reads", async () => {
  let calls = 0;
  const result = await getAdminVercelDomainStatus({
    siteKey: "yotteya",
    uid: null,
    dependencies: {
      readOwnerId: async () => {
        calls += 1;
        return "owner-1";
      },
      readSite: async () => {
        calls += 1;
        return {};
      },
      fetchHostStatus: async () => {
        calls += 1;
        return {};
      },
    },
  });

  assert.equal(result.status, 401);
  assert.equal(calls, 0);
});

test("owner mismatch returns 403 before site or Vercel reads", async () => {
  let protectedCalls = 0;
  const result = await getAdminVercelDomainStatus({
    siteKey: "yotteya",
    uid: "other-owner",
    dependencies: {
      readOwnerId: async () => "owner-1",
      readSite: async () => {
        protectedCalls += 1;
        return {};
      },
      fetchHostStatus: async () => {
        protectedCalls += 1;
        return {};
      },
    },
  });

  assert.equal(result.status, 403);
  assert.equal(protectedCalls, 0);
});

test("unset site domain returns 404 without calling Vercel", async () => {
  let vercelCalls = 0;
  const result = await getAdminVercelDomainStatus({
    siteKey: "yotteya",
    uid: "owner-1",
    dependencies: dependencies({
      site: { config: { keep: true } },
      fetchHostStatus: async () => {
        vercelCalls += 1;
        return {};
      },
    }),
  });

  assert.equal(result.status, 404);
  assert.equal(vercelCalls, 0);
});

test("domain is always read from sites and apex/www are both fetched", async () => {
  const calls = [];
  const result = await getAdminVercelDomainStatus({
    siteKey: "yotteya",
    uid: "owner-1",
    dependencies: dependencies({
      site: { domain: "Example.COM.", wwwEnabled: true },
      fetchHostStatus: async (hostname) => {
        calls.push(hostname);
        return dependencies().fetchHostStatus(hostname);
      },
    }),
  });

  assert.equal(result.status, 200);
  assert.deepEqual(calls, ["example.com", "www.example.com"]);
  assert.equal(result.body.domain, "example.com");
});

test("www is still inspected when wwwEnabled is false for read-only visibility", async () => {
  const calls = [];
  const result = await getAdminVercelDomainStatus({
    siteKey: "yotteya",
    uid: "owner-1",
    dependencies: dependencies({
      site: { domain: "example.com", wwwEnabled: false },
      fetchHostStatus: async (hostname) => {
        calls.push(hostname);
        return dependencies().fetchHostStatus(hostname);
      },
    }),
  });

  assert.equal(result.status, 200);
  assert.deepEqual(calls, ["example.com", "www.example.com"]);
  assert.equal(result.body.wwwEnabled, false);
});

test("verified and configured apex/www normalize to connection_complete", async () => {
  const result = await getAdminVercelDomainStatus({
    siteKey: "yotteya",
    uid: "owner-1",
    dependencies: dependencies(),
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.status, "connection_complete");
  assert.equal(result.body.configured, true);
  assert.equal(result.body.verified, true);
  assert.equal(result.body.misconfigured, false);
  assert.equal(result.body.hosts.apex.ssl.status, "ready");
  assert.equal(result.body.hosts.www.ssl.status, "ready");
});

test("apex keeps only valid unique A recommendations from mixed responses", () => {
  const apex = normalizeVercelHostStatus("example.com", "apex", {
    projectDomain: {
      verified: true,
      verification: [],
    },
    config: {
      configuredBy: "A",
      acceptedChallenges: ["http-01"],
      misconfigured: false,
      recommendedIPv4: [
        {
          rank: 1,
          value: [
            "216.198.79.1",
            "216.198.79.1",
            "not-an-ip",
            "2001:db8::1",
          ],
        },
        { rank: 2, value: ["76.76.21.21", 123, null] },
      ],
      recommendedCNAME: [
        { rank: 1, value: "example.vercel-dns.com." },
      ],
    },
  });

  assert.deepEqual(apex.dns.recommended, [
    { type: "A", rank: 1, value: "216.198.79.1" },
    { type: "A", rank: 2, value: "76.76.21.21" },
  ]);
});

test("www keeps only valid unique CNAME recommendations from mixed responses", () => {
  const www = normalizeVercelHostStatus("www.example.com", "www", {
    projectDomain: {
      verified: true,
      verification: [],
    },
    config: {
      configuredBy: "CNAME",
      acceptedChallenges: ["http-01"],
      misconfigured: false,
      recommendedIPv4: [{ rank: 1, value: ["216.198.79.1"] }],
      recommendedCNAME: [
        { rank: 1, value: "Example.Vercel-DNS.com." },
        { rank: 2, value: "example.vercel-dns.com" },
        { rank: 3, value: "https://invalid.example" },
        { rank: 4, value: "bad_host.example" },
        { rank: 5, value: 123 },
      ],
    },
  });

  assert.deepEqual(www.dns.recommended, [
    { type: "CNAME", rank: 1, value: "example.vercel-dns.com." },
  ]);
});

test("hosts return an empty recommendation list when no usable candidate exists", () => {
  const apex = normalizeVercelHostStatus("example.com", "apex", {
    projectDomain: { verified: true },
    config: {
      configuredBy: "A",
      acceptedChallenges: ["http-01"],
      misconfigured: false,
      recommendedIPv4: [{ rank: 1, value: ["invalid"] }],
      recommendedCNAME: [{ rank: 1, value: "valid.example." }],
    },
  });
  const www = normalizeVercelHostStatus("www.example.com", "www", {
    projectDomain: { verified: true },
    config: {
      configuredBy: "CNAME",
      acceptedChallenges: ["http-01"],
      misconfigured: false,
      recommendedIPv4: [{ rank: 1, value: ["216.198.79.1"] }],
      recommendedCNAME: [{ rank: 1, value: "bad_host.example" }],
    },
  });

  assert.deepEqual(apex.dns.recommended, []);
  assert.deepEqual(www.dns.recommended, []);
});

test("misconfigured DNS and verification waiting are normalized safely", () => {
  const waiting = normalizeVercelHostStatus("example.com", "apex", {
    projectDomain: {
      name: "example.com",
      apexName: "example.com",
      verified: false,
      redirect: null,
      redirectStatusCode: null,
      verification: [
        {
          type: "TXT",
          domain: "_vercel.example.com",
          value: "vc-domain-verify=example",
          reason: "pending",
          secret: "must-not-leak",
        },
      ],
    },
    config: {
      configuredBy: null,
      acceptedChallenges: ["dns-01"],
      recommendedIPv4: [{ rank: 1, value: ["76.76.21.21"] }],
      recommendedCNAME: [],
      misconfigured: true,
      rawSecret: "must-not-leak",
    },
  });

  assert.equal(waiting.status, "verification_pending");
  assert.equal(waiting.verified, false);
  assert.equal(waiting.misconfigured, true);
  assert.equal(waiting.ssl.status, "verification_pending");
  assert.deepEqual(waiting.verification, [
    {
      type: "TXT",
      domain: "_vercel.example.com",
      value: "vc-domain-verify=example",
      reason: "pending",
    },
  ]);
  assert.equal(JSON.stringify(waiting).includes("must-not-leak"), false);
});

test("Vercel environment, timeout, and upstream failures become safe 503", async () => {
  for (const reason of [
    "missing-configuration",
    "timeout",
    "upstream-401",
    "upstream-403",
    "upstream-404",
    "upstream-429",
    "upstream-500",
  ]) {
    const result = await getAdminVercelDomainStatus({
      siteKey: "yotteya",
      uid: "owner-1",
      dependencies: dependencies({
        fetchHostStatus: async () => {
          throw new VercelStatusUnavailableError(reason);
        },
      }),
    });

    assert.equal(result.status, 503, reason);
    assert.deepEqual(result.body, { error: "vercel-status-unavailable" });
  }
});

test("status lookup performs no writes", async () => {
  const dependencyNames = Object.keys(dependencies()).sort();
  assert.deepEqual(dependencyNames, [
    "fetchHostStatus",
    "readOwnerId",
    "readSite",
  ]);
});
