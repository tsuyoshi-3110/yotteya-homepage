import test from "node:test";
import assert from "node:assert/strict";
import { CUSTOMER } from "../../config/customer.ts";
import {
  buildHomeMetadata,
  buildPageMetadata,
  loadHomeMetadata,
  loadPageMetadata,
} from "./home-metadata.ts";

const oldMetadata = {
  title: CUSTOMER.seo.homeTitle,
  description: CUSTOMER.seo.homeDescription,
  keywords: Array.from(CUSTOMER.brand.keywords),
  alternates: { canonical: "https://yotteya.shop/" },
  openGraph: {
    title: CUSTOMER.seo.homeTitle,
    description: CUSTOMER.seo.homeDescription,
    url: "https://yotteya.shop/",
    siteName: CUSTOMER.brand.name,
    images: [
      {
        url: "https://yotteya.shop/images/ogpLogo.png",
        width: 1200,
        height: 630,
        alt: CUSTOMER.brand.name,
      },
    ],
    locale: "ja_JP",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: CUSTOMER.seo.homeTitle,
    description: CUSTOMER.seo.homeDescription,
    images: ["https://yotteya.shop/images/ogpLogo.png"],
  },
};

function legacyMetadata({
  path,
  title,
  description,
  type = "website",
  imagePath = CUSTOMER.brand.logoPath,
}) {
  const canonical = new URL(path, `${CUSTOMER.productionUrl}/`).toString();
  const image = new URL(
    imagePath,
    `${CUSTOMER.productionUrl}/`
  ).toString();

  return {
    title,
    description,
    keywords: Array.from(CUSTOMER.brand.keywords),
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: CUSTOMER.brand.name,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: CUSTOMER.brand.name,
        },
      ],
      locale: "ja_JP",
      type,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

const fixedPageCases = [
  {
    key: "about",
    expected: legacyMetadata({
      path: "/about",
      title: `当店の思い｜${CUSTOMER.brand.name}`,
      description: CUSTOMER.seo.aboutDescription,
    }),
  },
  {
    key: "news",
    expected: legacyMetadata({
      path: "/news",
      title: `お知らせ｜${CUSTOMER.brand.name}`,
      description: `${CUSTOMER.brand.name} の最新情報・限定メニュー・営業時間などのお知らせ。`,
    }),
  },
  {
    key: "areasLocal",
    expected: legacyMetadata({
      path: "/areas/local",
      title: CUSTOMER.seo.localTitle,
      description: CUSTOMER.seo.localDescription,
      type: "article",
    }),
  },
  {
    key: "products",
    expected: legacyMetadata({
      path: "/products",
      title: `メニュー一覧｜${CUSTOMER.brand.name}`,
      description: CUSTOMER.seo.productsDescription,
      imagePath: "/ogp-products.jpg",
    }),
  },
  {
    key: "productsEC",
    expected: legacyMetadata({
      path: "/products",
      title: `メニュー一覧｜${CUSTOMER.brand.name}`,
      description: CUSTOMER.seo.productsDescription,
      imagePath: "/ogp-products.jpg",
    }),
  },
  {
    key: "projects",
    expected: legacyMetadata({
      path: "/projects",
      title: CUSTOMER.seo.projectsTitle,
      description: CUSTOMER.seo.projectsDescription,
    }),
  },
  {
    key: "stores",
    expected: legacyMetadata({
      path: "/stores",
      title: `店舗一覧｜${CUSTOMER.brand.name}`,
      description: CUSTOMER.seo.storesDescription,
    }),
  },
  {
    key: "faq",
    expected: legacyMetadata({
      path: "/faq",
      title: `よくある質問（FAQ）｜${CUSTOMER.brand.name}`,
      description: CUSTOMER.seo.faqDescription,
      type: "article",
    }),
  },
];

test("current CUSTOMER produces the same values as the previous home SEO", () => {
  assert.deepEqual(buildHomeMetadata(CUSTOMER), oldMetadata);
});

for (const { key, expected } of fixedPageCases) {
  test(`${key} preserves the complete previous Metadata values`, () => {
    assert.deepEqual(buildPageMetadata(key, CUSTOMER), expected);
  });
}

test("valid Firestore config takes priority and produces absolute URLs", async () => {
  const metadata = await loadHomeMetadata({
    hostname: "www.yotteya.shop",
    fallback: oldMetadata,
    readSiteDocument: async (siteKey, hostname) => {
      assert.equal(siteKey, "yotteya");
      assert.equal(hostname, "www.yotteya.shop");
      return {
        config: {
          productionUrl: "https://tenant.example",
          brand: {
            name: "Firestore店名",
            logoPath: "/assets/og.png",
          },
          seo: {
            homeTitle: "Firestoreタイトル",
            homeDescription: "Firestore説明",
          },
        },
      };
    },
  });

  assert.equal(metadata.title, "Firestoreタイトル");
  assert.equal(metadata.description, "Firestore説明");
  assert.equal(metadata.alternates.canonical, "https://tenant.example/");
  assert.equal(metadata.openGraph.url, "https://tenant.example/");
  assert.equal(
    metadata.openGraph.images[0].url,
    "https://tenant.example/assets/og.png"
  );
  assert.deepEqual(metadata.twitter.images, [
    "https://tenant.example/assets/og.png",
  ]);
});

test("request hostname is never used directly as canonical", async () => {
  const metadata = await loadPageMetadata({
    pageKey: "home",
    hostname: "attacker-controlled.example",
    fallback: oldMetadata,
    readSiteDocument: async () => ({
      config: {
        seo: {
          homeTitle: "安全なタイトル",
        },
      },
    }),
  });

  assert.equal(metadata.title, "安全なタイトル");
  assert.equal(metadata.alternates.canonical, CUSTOMER.productionUrl + "/");
  assert.notEqual(
    metadata.alternates.canonical,
    "https://attacker-controlled.example/"
  );
});

test("missing sites document preserves the previous metadata completely", async () => {
  const metadata = await loadHomeMetadata({
    hostname: "yotteya.shop",
    fallback: oldMetadata,
    readSiteDocument: async () => null,
  });

  assert.strictEqual(metadata, oldMetadata);
});

test("Firestore failures preserve the previous metadata completely", async () => {
  const metadata = await loadHomeMetadata({
    hostname: "yotteya.shop",
    fallback: oldMetadata,
    readSiteDocument: async () => {
      throw new Error("Firestore unavailable");
    },
  });

  assert.strictEqual(metadata, oldMetadata);
});

test("an invalid scalar preserves the previous metadata completely", async () => {
  const metadata = await loadHomeMetadata({
    hostname: "yotteya.shop",
    fallback: oldMetadata,
    readSiteDocument: async () => ({
      config: {
        seo: {
          homeTitle: 123,
        },
      },
    }),
  });

  assert.strictEqual(metadata, oldMetadata);
});

test("an invalid array element preserves the previous metadata completely", async () => {
  const metadata = await loadHomeMetadata({
    hostname: "yotteya.shop",
    fallback: oldMetadata,
    readSiteDocument: async () => ({
      config: {
        brand: {
          keywords: ["valid", false],
        },
      },
    }),
  });

  assert.strictEqual(metadata, oldMetadata);
});

test("a malformed config envelope preserves the previous metadata completely", async () => {
  const metadata = await loadHomeMetadata({
    hostname: "yotteya.shop",
    fallback: oldMetadata,
    readSiteDocument: async () => ({ config: "invalid" }),
  });

  assert.strictEqual(metadata, oldMetadata);
});

test("unknown fields are ignored without blocking valid SEO overrides", async () => {
  const metadata = await loadHomeMetadata({
    hostname: "yotteya.shop",
    fallback: oldMetadata,
    readSiteDocument: async () => ({
      unknownRoot: true,
      config: {
        unknownConfig: true,
        seo: {
          homeTitle: "有効なタイトル",
        },
      },
    }),
  });

  assert.equal(metadata.title, "有効なタイトル");
  assert.equal(metadata.description, CUSTOMER.seo.homeDescription);
  assert.equal("unknownRoot" in metadata, false);
});

test("fixed-page Firestore failures preserve the complete previous Metadata", async () => {
  const fallback = fixedPageCases.find(({ key }) => key === "stores").expected;
  const metadata = await loadPageMetadata({
    pageKey: "stores",
    hostname: "",
    fallback,
    readSiteDocument: async () => {
      throw new Error("Firestore unavailable");
    },
  });

  assert.strictEqual(metadata, fallback);
});

test("fixed-page invalid Firestore data preserves the complete previous Metadata", async () => {
  const fallback = fixedPageCases.find(({ key }) => key === "faq").expected;
  const metadata = await loadPageMetadata({
    pageKey: "faq",
    hostname: "",
    fallback,
    readSiteDocument: async () => ({
      config: {
        seo: {
          faqDescription: false,
        },
      },
    }),
  });

  assert.strictEqual(metadata, fallback);
});
