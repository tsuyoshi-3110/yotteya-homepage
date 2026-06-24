export const DOMAIN_REGISTRY_SETTINGS = Object.freeze({
  siteKey: "yotteya",
  canonicalHost: "yotteya.shop",
  domain: "yotteya.shop",
  wwwEnabled: true,
  domainStatus: "active",
});

export const DOMAIN_REGISTRY_TARGETS = Object.freeze([
  "domains/yotteya.shop",
  "domains/www.yotteya.shop",
  "sites/yotteya",
]);

function isPlainObject(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function buildDomainDocumentPlan(
  documentPath,
  documentData,
  desired = DOMAIN_REGISTRY_SETTINGS
) {
  const existing = isPlainObject(documentData) ? documentData : {};
  const additions = [];
  const unchanged = [];
  const conflicts = [];

  for (const [field, proposed] of Object.entries(desired)) {
    const path = `${documentPath}.${field}`;
    const current = existing[field];

    if (current === undefined) {
      additions.push({ path, field, value: structuredClone(proposed) });
    } else if (sameValue(current, proposed)) {
      unchanged.push({ path, field, value: current });
    } else {
      conflicts.push({
        path,
        field,
        current,
        proposed,
        reason:
          field === "siteKey"
            ? "different siteKey is already registered"
            : "existing value differs",
      });
    }
  }

  return { documentPath, additions, unchanged, conflicts };
}

export function buildDomainRegistryPlan(
  documents,
  desired = DOMAIN_REGISTRY_SETTINGS
) {
  const targets = DOMAIN_REGISTRY_TARGETS.map((documentPath) =>
    buildDomainDocumentPlan(documentPath, documents[documentPath], desired)
  );

  return {
    targets,
    additions: targets.flatMap((target) => target.additions),
    unchanged: targets.flatMap((target) => target.unchanged),
    conflicts: targets.flatMap((target) => target.conflicts),
  };
}

export function buildDomainDocumentPatch(documentPlan) {
  return Object.fromEntries(
    documentPlan.additions.map(({ field, value }) => [
      field,
      structuredClone(value),
    ])
  );
}

export function hasSiteKeyConflict(plan) {
  return plan.conflicts.some(({ field }) => field === "siteKey");
}

export function summarizeDomainRegistryPlan(plan) {
  return {
    targets: plan.targets.length,
    additions: plan.additions.length,
    unchanged: plan.unchanged.length,
    conflicts: plan.conflicts.length,
  };
}
