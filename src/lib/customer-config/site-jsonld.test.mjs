import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { CUSTOMER } from "../../config/customer.ts";
import {
  buildDefaultSiteJsonLdGraph,
  buildSiteJsonLdGraph,
  loadSiteJsonLdGraph,
} from "./site-jsonld.ts";

const mainImage = "https://yotteya.shop/images/ogpLogo.png";
const legacyLayoutGraph = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://yotteya.shop#org",
      name: "甘味処 よって屋",
      url: "https://yotteya.shop",
      logo: mainImage,
      image: [mainImage],
      sameAs: [
        "https://www.instagram.com/yotteya.crape/",
        "https://lin.ee/YcKAJja",
      ],
    },
    {
      "@type": "WebSite",
      "@id": "https://yotteya.shop#website",
      name: "甘味処 よって屋",
      url: "https://yotteya.shop",
      publisher: { "@id": "https://yotteya.shop#org" },
    },
    {
      "@type": "LocalBusiness",
      "@id": "https://yotteya.shop#local",
      name: "甘味処 よって屋",
      url: "https://yotteya.shop",
      image: [mainImage],
      address: {
        "@type": "PostalAddress",
        addressCountry: "JP",
        addressRegion: "大阪府",
        addressLocality: "大阪市東淀川区",
        streetAddress: "淡路４丁目１８−１６",
      },
      hasMap:
        "https://www.google.com/maps/search/?api=1&query=" +
        encodeURIComponent("大阪市東淀川区淡路４丁目１８−１６"),
      priceRange: "￥￥",
    },
  ],
};

test("CUSTOMER matches the captured production JSON-LD baseline", async () => {
  const fixture = JSON.parse(
    await readFile(
      new URL(
        "../../../tests/fixtures/production-home-jsonld-2026-06-22.json",
        import.meta.url
      ),
      "utf8"
    )
  );

  assert.deepEqual(buildSiteJsonLdGraph(CUSTOMER), fixture.scripts[0]);
});

test("CUSTOMER preserves the complete current layout JSON-LD graph", () => {
  assert.deepEqual(buildSiteJsonLdGraph(CUSTOMER), legacyLayoutGraph);
  assert.deepEqual(buildDefaultSiteJsonLdGraph(), legacyLayoutGraph);
});

test("the graph contains one Organization, WebSite, and LocalBusiness", () => {
  const graph = buildDefaultSiteJsonLdGraph();
  assert.deepEqual(
    graph["@graph"].map((entity) => entity["@type"]),
    ["Organization", "WebSite", "LocalBusiness"]
  );
  assert.equal(new Set(graph["@graph"].map((entity) => entity["@id"])).size, 3);
});

test("Google-required identity and local business fields are present", () => {
  const [organization, website, localBusiness] =
    buildDefaultSiteJsonLdGraph()["@graph"];

  assert.equal(typeof organization.name, "string");
  assert.match(organization.url, /^https:\/\//);
  assert.match(organization.logo, /^https:\/\//);

  assert.equal(typeof website.name, "string");
  assert.match(website.url, /^https:\/\//);
  assert.deepEqual(website.publisher, { "@id": organization["@id"] });

  assert.equal(typeof localBusiness.name, "string");
  assert.match(localBusiness.url, /^https:\/\//);
  assert.ok(Array.isArray(localBusiness.image));
  assert.equal(localBusiness.address["@type"], "PostalAddress");
  assert.equal(typeof localBusiness.address.addressCountry, "string");
  assert.equal(typeof localBusiness.address.addressRegion, "string");
  assert.equal(typeof localBusiness.address.addressLocality, "string");
  assert.equal(typeof localBusiness.address.streetAddress, "string");
  assert.equal(typeof localBusiness.priceRange, "string");
});

test("valid sites config overrides the graph and keeps URLs absolute", async () => {
  const graph = await loadSiteJsonLdGraph({
    fallback: legacyLayoutGraph,
    readSiteDocument: async (siteKey) => {
      assert.equal(siteKey, "yotteya");
      return {
        config: {
          productionUrl: "https://tenant.example/",
          brand: {
            name: "Firestore 店舗",
            telephone: "06-0000-0000",
            logoPath: "/assets/logo.png",
          },
          address: {
            text: "大阪府大阪市テスト1-2-3",
            region: "大阪府",
            locality: "大阪市",
            street: "テスト1-2-3",
          },
          social: {
            instagram: "https://instagram.com/firestore-shop",
          },
        },
      };
    },
  });
  const [organization, website, localBusiness] = graph["@graph"];

  assert.equal(organization.name, "Firestore 店舗");
  assert.equal(organization.logo, "https://tenant.example/assets/logo.png");
  assert.equal(organization.telephone, "06-0000-0000");
  assert.equal(website.url, "https://tenant.example");
  assert.equal(localBusiness.url, "https://tenant.example");
  assert.deepEqual(localBusiness.image, [
    "https://tenant.example/assets/logo.png",
  ]);
});

test("a missing sites document returns the exact current fallback", async () => {
  const graph = await loadSiteJsonLdGraph({
    fallback: legacyLayoutGraph,
    readSiteDocument: async () => null,
  });
  assert.strictEqual(graph, legacyLayoutGraph);
});

test("Firestore failure returns the exact current fallback", async () => {
  const graph = await loadSiteJsonLdGraph({
    fallback: legacyLayoutGraph,
    readSiteDocument: async () => {
      throw new Error("Firestore unavailable");
    },
  });
  assert.strictEqual(graph, legacyLayoutGraph);
});

test("invalid sites config returns the exact current fallback", async () => {
  const invalidCases = [
    { config: "invalid" },
    { config: { brand: { name: 123 } } },
    { config: { structuredData: { types: ["LocalBusiness", false] } } },
  ];

  for (const documentData of invalidCases) {
    const graph = await loadSiteJsonLdGraph({
      fallback: legacyLayoutGraph,
      readSiteDocument: async () => documentData,
    });
    assert.strictEqual(graph, legacyLayoutGraph);
  }
});

test("unknown fields are ignored while valid sites values are applied", async () => {
  const graph = await loadSiteJsonLdGraph({
    fallback: legacyLayoutGraph,
    readSiteDocument: async () => ({
      unknownDocumentField: true,
      config: {
        unknownConfigField: true,
        brand: {
          name: "有効な店名",
          unknownBrandField: true,
        },
      },
    }),
  });

  assert.equal(graph["@graph"][0].name, "有効な店名");
  assert.equal("unknownDocumentField" in graph, false);
  assert.equal("unknownConfigField" in graph, false);
  assert.equal("unknownBrandField" in graph["@graph"][0], false);
});
