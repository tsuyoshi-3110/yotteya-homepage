import test from "node:test";
import assert from "node:assert/strict";
import {
  getDomainLookupCandidates,
  normalizeHostname,
  resolveTenantSiteKey,
} from "./tenant-resolver.ts";

test("hostname normalization lowercases and removes port and trailing dot", () => {
  assert.equal(normalizeHostname("WWW.Example.COM.:443"), "www.example.com");
  assert.equal(normalizeHostname("Example.COM:3000"), "example.com");
});

test("www and apex domains are both lookup candidates", () => {
  assert.deepEqual(getDomainLookupCandidates("example.com"), [
    "example.com",
    "www.example.com",
  ]);
  assert.deepEqual(getDomainLookupCandidates("www.example.com"), [
    "www.example.com",
    "example.com",
  ]);
});

test("an apex request can resolve through a registered www domain", async () => {
  const reads = [];
  const resolution = await resolveTenantSiteKey({
    host: "EXAMPLE.COM:443",
    fallbackSiteKey: "yotteya",
    readDomainDocument: async (hostname) => {
      reads.push(hostname);
      return hostname === "www.example.com"
        ? { siteKey: "tenant-example" }
        : null;
    },
  });

  assert.deepEqual(reads, ["example.com", "www.example.com"]);
  assert.deepEqual(resolution, {
    siteKey: "tenant-example",
    hostname: "example.com",
    reason: "domain-registry",
    matchedDomain: "www.example.com",
  });
});

test("a www request can resolve through a registered apex domain", async () => {
  const resolution = await resolveTenantSiteKey({
    host: "www.example.com.",
    fallbackSiteKey: "yotteya",
    readDomainDocument: async (hostname) =>
      hostname === "example.com" ? { siteKey: "tenant-example" } : null,
  });

  assert.equal(resolution.siteKey, "tenant-example");
  assert.equal(resolution.matchedDomain, "example.com");
});

test("unregistered domains preserve the existing site", async () => {
  const resolution = await resolveTenantSiteKey({
    host: "unknown.example",
    fallbackSiteKey: "yotteya",
    readDomainDocument: async () => null,
  });

  assert.deepEqual(resolution, {
    siteKey: "yotteya",
    hostname: "unknown.example",
    reason: "unregistered-domain",
  });
});

test("registry failures preserve the existing site", async () => {
  const resolution = await resolveTenantSiteKey({
    host: "example.com",
    fallbackSiteKey: "yotteya",
    readDomainDocument: async () => {
      throw new Error("Firestore unavailable");
    },
  });

  assert.equal(resolution.siteKey, "yotteya");
  assert.equal(resolution.reason, "registry-error");
});

test("localhost, loopback addresses, and Vercel previews skip registry lookup", async () => {
  for (const host of [
    "localhost:3000",
    "127.0.0.1:3000",
    "[::1]:3000",
    "feature-branch-project.vercel.app",
  ]) {
    let reads = 0;
    const resolution = await resolveTenantSiteKey({
      host,
      fallbackSiteKey: "yotteya",
      readDomainDocument: async () => {
        reads += 1;
        return { siteKey: "unexpected" };
      },
    });

    assert.equal(resolution.siteKey, "yotteya");
    assert.equal(reads, 0);
  }
});

test("malicious or malformed Host values never reach the registry", async () => {
  const maliciousHosts = [
    "https://evil.example",
    "trusted.example@evil.example",
    "evil.example/path",
    "evil.example?query=1",
    "evil.example#fragment",
    "evil.example, trusted.example",
    " evil.example",
    "evil.example ",
    "evil.example\nx-forwarded-host:trusted.example",
    "evil.example:invalid",
  ];

  for (const host of maliciousHosts) {
    let reads = 0;
    const resolution = await resolveTenantSiteKey({
      host,
      fallbackSiteKey: "yotteya",
      readDomainDocument: async () => {
        reads += 1;
        return { siteKey: "attacker" };
      },
    });

    assert.equal(resolution.siteKey, "yotteya");
    assert.equal(resolution.hostname, null);
    assert.equal(resolution.reason, "invalid-host");
    assert.equal(reads, 0);
  }
});

test("invalid domain documents cannot select another tenant", async () => {
  for (const documentData of [
    {},
    { siteKey: "" },
    { siteKey: "../other" },
    { siteKey: 123 },
  ]) {
    const resolution = await resolveTenantSiteKey({
      host: "example.com",
      fallbackSiteKey: "yotteya",
      readDomainDocument: async () => documentData,
    });

    assert.equal(resolution.siteKey, "yotteya");
    assert.equal(resolution.reason, "unregistered-domain");
  }
});
