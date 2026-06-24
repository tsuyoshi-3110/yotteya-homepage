import test from "node:test";
import assert from "node:assert/strict";
import { CUSTOMER } from "../../config/customer.ts";
import {
  mergeCustomerConfig,
  resolveCustomerConfigDocument,
} from "./resolve.ts";

test("scalar overrides are accepted only when their runtime types match", () => {
  const resolved = resolveCustomerConfigDocument({
    config: {
      brand: {
        name: "新しい店名",
        telephone: 12345,
      },
      address: {
        latitude: "34.700",
        longitude: 135.5,
      },
      ai: {
        retail: "yes",
      },
    },
  });

  assert.equal(resolved.brand.name, "新しい店名");
  assert.equal(resolved.brand.telephone, CUSTOMER.brand.telephone);
  assert.equal(resolved.address.latitude, CUSTOMER.address.latitude);
  assert.equal(resolved.address.longitude, 135.5);
  assert.equal(resolved.ai.retail, CUSTOMER.ai.retail);
});

test("scalar null values fall back to the existing customer config", () => {
  const resolved = resolveCustomerConfigDocument({
    config: {
      productionUrl: null,
      address: {
        latitude: null,
      },
    },
  });

  assert.equal(resolved.productionUrl, CUSTOMER.productionUrl);
  assert.equal(resolved.address.latitude, CUSTOMER.address.latitude);
});

test("primitive arrays are replaced only when every item matches the template type", () => {
  const valid = resolveCustomerConfigDocument({
    config: {
      brand: {
        keywords: ["新規", "キーワード"],
      },
    },
  });
  const invalid = resolveCustomerConfigDocument({
    config: {
      brand: {
        keywords: ["新規", 123],
      },
    },
  });

  assert.deepEqual(valid.brand.keywords, ["新規", "キーワード"]);
  assert.deepEqual(invalid.brand.keywords, CUSTOMER.brand.keywords);
});

test("object arrays require every item to match the template element structure", () => {
  const validFaq = [
    { question: "新しい質問", answer: "新しい回答", unknown: "ignored" },
  ];
  const invalidFaq = [
    { question: "新しい質問", answer: 123 },
  ];

  const valid = resolveCustomerConfigDocument({
    config: { faq: validFaq },
  });
  const invalid = resolveCustomerConfigDocument({
    config: { faq: invalidFaq },
  });

  assert.deepEqual(valid.faq, [
    { question: "新しい質問", answer: "新しい回答" },
  ]);
  assert.deepEqual(invalid.faq, CUSTOMER.faq);
});

test("nested arrays inside object-array elements are validated recursively", () => {
  const resolved = resolveCustomerConfigDocument({
    config: {
      localPage: {
        services: [
          {
            title: "新サービス",
            bullets: ["有効", false],
          },
        ],
      },
    },
  });

  assert.deepEqual(resolved.localPage.services, CUSTOMER.localPage.services);
});

test("unknown fields remain excluded at every object level", () => {
  const resolved = resolveCustomerConfigDocument({
    unknownRoot: "ignored",
    config: {
      unknownConfig: "ignored",
      brand: {
        name: "新しい店名",
        unknownBrand: "ignored",
      },
    },
  });

  assert.equal("unknownRoot" in resolved, false);
  assert.equal("unknownConfig" in resolved, false);
  assert.equal("unknownBrand" in resolved.brand, false);
  assert.equal(resolved.brand.name, "新しい店名");
});

test("mergeCustomerConfig also validates untyped runtime input", () => {
  const resolved = mergeCustomerConfig(
    CUSTOMER,
    {
      address: {
        latitude: [],
      },
    }
  );

  assert.equal(resolved.address.latitude, CUSTOMER.address.latitude);
});
