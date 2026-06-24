const CONFIG_FIELD = "config";

export function isPlainObject(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function valueType(value) {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value;
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function validateConfigValue(value, template, path = "") {
  const errors = [];

  if (Array.isArray(template)) {
    if (!Array.isArray(value)) {
      errors.push(`${path || "<root>"}: expected array, received ${valueType(value)}`);
      return errors;
    }

    const itemTemplate = template[0];
    if (itemTemplate !== undefined) {
      value.forEach((item, index) => {
        errors.push(
          ...validateConfigValue(item, itemTemplate, `${path}[${index}]`)
        );
      });
    }
    return errors;
  }

  if (isPlainObject(template)) {
    if (!isPlainObject(value)) {
      errors.push(`${path || "<root>"}: expected object, received ${valueType(value)}`);
      return errors;
    }

    for (const [key, childTemplate] of Object.entries(template)) {
      if (!(key in value)) {
        errors.push(`${path ? `${path}.` : ""}${key}: missing`);
        continue;
      }
      errors.push(
        ...validateConfigValue(
          value[key],
          childTemplate,
          path ? `${path}.${key}` : key
        )
      );
    }
    return errors;
  }

  if (typeof value !== typeof template) {
    errors.push(
      `${path || "<root>"}: expected ${typeof template}, received ${valueType(value)}`
    );
  }

  return errors;
}

function containsKnownConfigKey(documentData, defaults) {
  return Object.keys(defaults).some((key) =>
    Object.prototype.hasOwnProperty.call(documentData, key)
  );
}

export function detectConfigLayout(documentData, defaults) {
  if (!isPlainObject(documentData)) return "config";
  if (isPlainObject(documentData[CONFIG_FIELD])) return "config";
  if (containsKnownConfigKey(documentData, defaults)) return "root";
  return "config";
}

function collectPlan(defaultValue, currentValue, path, result) {
  if (currentValue === undefined) {
    result.additions.push({ path, value: structuredClone(defaultValue) });
    return;
  }

  if (isPlainObject(defaultValue)) {
    if (!isPlainObject(currentValue)) {
      result.conflicts.push({
        path,
        current: currentValue,
        proposed: defaultValue,
        reason: `expected object, received ${valueType(currentValue)}`,
      });
      return;
    }

    for (const [key, childDefault] of Object.entries(defaultValue)) {
      collectPlan(
        childDefault,
        currentValue[key],
        path ? `${path}.${key}` : key,
        result
      );
    }
    return;
  }

  if (sameValue(currentValue, defaultValue)) {
    result.unchanged.push({ path, value: currentValue });
    return;
  }

  result.conflicts.push({
    path,
    current: currentValue,
    proposed: defaultValue,
    reason: "existing value differs",
  });
}

export function buildMigrationPlan(documentData, defaults) {
  const existing = isPlainObject(documentData) ? documentData : {};
  const layout = detectConfigLayout(existing, defaults);
  const currentConfig = layout === "config" ? existing[CONFIG_FIELD] : existing;
  const result = {
    layout,
    additions: [],
    conflicts: [],
    unchanged: [],
  };

  collectPlan(
    defaults,
    isPlainObject(currentConfig) ? currentConfig : undefined,
    layout === "config" ? CONFIG_FIELD : "",
    result
  );

  return result;
}

function setNestedValue(target, path, value) {
  const parts = path.split(".");
  let cursor = target;

  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index];
    if (!isPlainObject(cursor[key])) cursor[key] = {};
    cursor = cursor[key];
  }

  cursor[parts.at(-1)] = structuredClone(value);
}

export function buildAdditionsPatch(plan) {
  const patch = {};
  for (const addition of plan.additions) {
    setNestedValue(patch, addition.path, addition.value);
  }
  return patch;
}

export function summarizePlan(plan) {
  return {
    additions: plan.additions.length,
    conflicts: plan.conflicts.length,
    unchanged: plan.unchanged.length,
  };
}

export function toBackupJsonValue(value) {
  if (value === undefined) return null;
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toBackupJsonValue);
  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  if (typeof value.toJSON === "function") {
    return toBackupJsonValue(value.toJSON());
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      toBackupJsonValue(child),
    ])
  );
}
