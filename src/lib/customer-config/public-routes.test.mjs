import test from "node:test";
import assert from "node:assert/strict";
import { CUSTOMER } from "../../config/customer.ts";
import {
  buildTenantRobots,
  buildTenantSitemap,
  loadTenantRobots,
  loadTenantSitemap,
  SITEMAP_PATHS,
} from "./public-routes.ts";

const fixedTimestamp = "2026-06-22T00:00:00.000Z";
const legacyRobots = {
  rules: [{ userAgent: "*", allow: "/" }],
  sitemap: [
    "https://yotteya.shop/sitemap.xml",
    "https://yotteya.shop/video-sitemap.xml",
  ],
  host: "https://yotteya.shop",
};
const legacySitemap = SITEMAP_PATHS.map((pathname) => ({
  url: new URL(pathname, "https://yotteya.shop/").toString(),
  lastModified: fixedTimestamp,
  changeFrequency: pathname === "/" ? "daily" : "weekly",
  priority: pathname === "/" ? 1.0 : 0.6,
}));

test("current CUSTOMER preserves the complete robots output", () => {
  assert.deepEqual(buildTenantRobots(CUSTOMER), legacyRobots);
});

test("current CUSTOMER preserves sitemap URLs, paths, frequency, and priority", () => {
  assert.deepEqual(
    buildTenantSitemap(CUSTOMER, fixedTimestamp),
    legacySitemap
  );
});

test("valid Firestore productionUrl takes priority without using request hostname", async () => {
  const robots = await loadTenantRobots({
    siteKey: "tenant",
    hostname: "attacker.example",
    fallback: legacyRobots,
    readSiteDocument: async () => ({
      config: { productionUrl: "https://tenant.example" },
    }),
  });
  const sitemap = await loadTenantSitemap({
    siteKey: "tenant",
    hostname: "attacker.example",
    fallback: legacySitemap,
    lastModified: fixedTimestamp,
    readSiteDocument: async () => ({
      config: { productionUrl: "https://tenant.example" },
    }),
  });

  assert.equal(robots.host, "https://tenant.example");
  assert.deepEqual(robots.sitemap, [
    "https://tenant.example/sitemap.xml",
    "https://tenant.example/video-sitemap.xml",
  ]);
  assert.equal(sitemap[0].url, "https://tenant.example/");
  assert.equal(
    sitemap.some(({ url }) => url.includes("attacker.example")),
    false
  );
});

test("missing sites document preserves current robots and sitemap exactly", async () => {
  const robots = await loadTenantRobots({
    hostname: "unknown.example",
    fallback: legacyRobots,
    readSiteDocument: async () => null,
  });
  const sitemap = await loadTenantSitemap({
    hostname: "unknown.example",
    fallback: legacySitemap,
    lastModified: fixedTimestamp,
    readSiteDocument: async () => null,
  });

  assert.strictEqual(robots, legacyRobots);
  assert.strictEqual(sitemap, legacySitemap);
});

test("Firestore failures preserve current robots and sitemap exactly", async () => {
  const failure = async () => {
    throw new Error("Firestore unavailable");
  };
  const robots = await loadTenantRobots({
    hostname: "yotteya.shop",
    fallback: legacyRobots,
    readSiteDocument: failure,
  });
  const sitemap = await loadTenantSitemap({
    hostname: "yotteya.shop",
    fallback: legacySitemap,
    lastModified: fixedTimestamp,
    readSiteDocument: failure,
  });

  assert.strictEqual(robots, legacyRobots);
  assert.strictEqual(sitemap, legacySitemap);
});

test("invalid config and invalid productionUrl preserve current outputs", async () => {
  for (const documentData of [
    { config: { productionUrl: 123 } },
    { config: { productionUrl: "javascript:alert(1)" } },
    { config: "invalid" },
  ]) {
    const robots = await loadTenantRobots({
      hostname: "yotteya.shop",
      fallback: legacyRobots,
      readSiteDocument: async () => documentData,
    });
    const sitemap = await loadTenantSitemap({
      hostname: "yotteya.shop",
      fallback: legacySitemap,
      lastModified: fixedTimestamp,
      readSiteDocument: async () => documentData,
    });

    assert.strictEqual(robots, legacyRobots);
    assert.strictEqual(sitemap, legacySitemap);
  }
});
