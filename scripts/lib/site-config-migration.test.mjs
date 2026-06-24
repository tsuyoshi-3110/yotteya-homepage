import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAdditionsPatch,
  buildMigrationPlan,
  detectConfigLayout,
  validateConfigValue,
} from "./site-config-migration.mjs";
import { CUSTOMER } from "../../src/config/customer.ts";

const defaults = {
  siteKey: "yotteya",
  brand: {
    name: "よって屋",
    keywords: ["クレープ", "大阪"],
  },
  enabled: true,
};

test("current customer.ts passes runtime type validation", () => {
  assert.deepEqual(validateConfigValue(CUSTOMER, CUSTOMER), []);
});

test("complete config passes runtime type validation", () => {
  assert.deepEqual(validateConfigValue(structuredClone(defaults), defaults), []);
});

test("runtime validation reports missing fields and invalid types", () => {
  assert.deepEqual(validateConfigValue(
    { siteKey: 123, brand: { name: "よって屋", keywords: "invalid" } },
    defaults
  ), [
    "siteKey: expected string, received number",
    "brand.keywords: expected array, received string",
    "enabled: missing",
  ]);
});

test("config envelope is preferred for a new or metadata-only document", () => {
  assert.equal(detectConfigLayout({}, defaults), "config");
  assert.equal(detectConfigLayout({ createdAt: "existing" }, defaults), "config");
});

test("legacy root layout remains compatible when known fields already exist", () => {
  assert.equal(detectConfigLayout({ siteKey: "yotteya" }, defaults), "root");
});

test("plan adds only missing fields and preserves differing existing values", () => {
  const existing = {
    owner: "untouched",
    config: {
      siteKey: "yotteya",
      brand: {
        name: "既存名称",
      },
    },
  };

  const plan = buildMigrationPlan(existing, defaults);

  assert.deepEqual(plan.additions.map(({ path }) => path), [
    "config.brand.keywords",
    "config.enabled",
  ]);
  assert.deepEqual(plan.conflicts.map(({ path }) => path), [
    "config.brand.name",
  ]);
  assert.deepEqual(plan.unchanged.map(({ path }) => path), [
    "config.siteKey",
  ]);
  assert.deepEqual(buildAdditionsPatch(plan), {
    config: {
      brand: { keywords: ["クレープ", "大阪"] },
      enabled: true,
    },
  });
  assert.equal(existing.owner, "untouched");
  assert.equal(existing.config.brand.name, "既存名称");
});

test("a scalar parent is a conflict and is never replaced", () => {
  const plan = buildMigrationPlan({ config: { brand: "keep-me" } }, defaults);

  assert.equal(plan.additions.some(({ path }) => path.startsWith("config.brand")), false);
  assert.deepEqual(plan.conflicts.map(({ path }) => path), ["config.brand"]);
});

test("arrays are treated atomically and existing arrays are not merged", () => {
  const plan = buildMigrationPlan({
    config: {
      ...defaults,
      brand: {
        ...defaults.brand,
        keywords: ["既存"],
      },
    },
  }, defaults);

  assert.deepEqual(plan.conflicts.map(({ path }) => path), [
    "config.brand.keywords",
  ]);
  assert.equal(plan.additions.length, 0);
});
