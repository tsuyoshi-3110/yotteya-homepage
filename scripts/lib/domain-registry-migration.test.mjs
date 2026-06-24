import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDomainDocumentPatch,
  buildDomainRegistryPlan,
  DOMAIN_REGISTRY_SETTINGS,
  DOMAIN_REGISTRY_TARGETS,
  hasSiteKeyConflict,
  summarizeDomainRegistryPlan,
} from "./domain-registry-migration.mjs";

test("empty documents add all settings to exactly the three allowed targets", () => {
  const plan = buildDomainRegistryPlan({});

  assert.deepEqual(
    plan.targets.map(({ documentPath }) => documentPath),
    DOMAIN_REGISTRY_TARGETS
  );
  assert.equal(plan.additions.length, 15);
  assert.equal(plan.unchanged.length, 0);
  assert.equal(plan.conflicts.length, 0);
});

test("matching existing fields are unchanged and unknown fields are preserved", () => {
  const plan = buildDomainRegistryPlan({
    "domains/yotteya.shop": {
      siteKey: "yotteya",
      ownerNote: "untouched",
    },
  });
  const apex = plan.targets[0];

  assert.deepEqual(apex.unchanged.map(({ field }) => field), ["siteKey"]);
  assert.equal(apex.additions.length, 4);
  assert.deepEqual(buildDomainDocumentPatch(apex), {
    canonicalHost: "yotteya.shop",
    domain: "yotteya.shop",
    wwwEnabled: true,
    domainStatus: "active",
  });
});

test("different siteKey is a blocking conflict and is never patched", () => {
  const plan = buildDomainRegistryPlan({
    "domains/www.yotteya.shop": {
      siteKey: "another-tenant",
    },
  });
  const www = plan.targets[1];

  assert.equal(hasSiteKeyConflict(plan), true);
  assert.deepEqual(www.conflicts, [
    {
      path: "domains/www.yotteya.shop.siteKey",
      field: "siteKey",
      current: "another-tenant",
      proposed: "yotteya",
      reason: "different siteKey is already registered",
    },
  ]);
  assert.equal("siteKey" in buildDomainDocumentPatch(www), false);
});

test("other differing fields are reported and never overwritten", () => {
  const plan = buildDomainRegistryPlan({
    "sites/yotteya": {
      domainStatus: "suspended",
      config: { existing: true },
    },
  });
  const site = plan.targets[2];

  assert.deepEqual(site.conflicts.map(({ field }) => field), ["domainStatus"]);
  assert.equal("domainStatus" in buildDomainDocumentPatch(site), false);
  assert.equal(plan.conflicts.length, 1);
});

test("fully migrated documents produce no additions or conflicts", () => {
  const documents = Object.fromEntries(
    DOMAIN_REGISTRY_TARGETS.map((path) => [
      path,
      { ...DOMAIN_REGISTRY_SETTINGS },
    ])
  );
  const plan = buildDomainRegistryPlan(documents);

  assert.deepEqual(summarizeDomainRegistryPlan(plan), {
    targets: 3,
    additions: 0,
    unchanged: 15,
    conflicts: 0,
  });
});
