import { CUSTOMER } from "../../config/customer.ts";
import type {
  CustomerConfig,
  CustomerConfigOverride,
  CustomerSiteDocument,
} from "../../config/customer.types";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type ValidationResult =
  | { valid: true; value: unknown }
  | { valid: false };

/**
 * 配列の置換前検証用。テンプレートと同じ構造・scalar型だけを許可し、
 * オブジェクト内の未知フィールドは返却値から除外します。
 */
function validateCompleteValue(
  template: unknown,
  candidate: unknown
): ValidationResult {
  if (Array.isArray(template)) {
    if (!Array.isArray(candidate)) return { valid: false };

    const itemTemplate = template[0];
    if (itemTemplate === undefined) {
      return { valid: true, value: candidate };
    }

    const values: unknown[] = [];
    for (const item of candidate) {
      const result = validateCompleteValue(itemTemplate, item);
      if (!result.valid) return { valid: false };
      values.push(result.value);
    }
    return { valid: true, value: values };
  }

  if (isRecord(template)) {
    if (!isRecord(candidate)) return { valid: false };

    const entries: [string, unknown][] = [];
    for (const [key, childTemplate] of Object.entries(template)) {
      if (!(key in candidate)) return { valid: false };

      const result = validateCompleteValue(childTemplate, candidate[key]);
      if (!result.valid) return { valid: false };
      entries.push([key, result.value]);
    }
    return { valid: true, value: Object.fromEntries(entries) };
  }

  return typeof candidate === typeof template
    ? { valid: true, value: candidate }
    : { valid: false };
}

function validatePartialValue(template: unknown, candidate: unknown): boolean {
  if (Array.isArray(template)) {
    return validateCompleteValue(template, candidate).valid;
  }

  if (isRecord(template)) {
    if (!isRecord(candidate)) return false;

    return Object.entries(template).every(
      ([key, childTemplate]) =>
        !(key in candidate) ||
        validatePartialValue(childTemplate, candidate[key])
    );
  }

  return typeof candidate === typeof template;
}

/**
 * base に存在するキーだけを再帰的に上書きします。
 * scalar は既存値と同じ型だけ、配列は全要素がテンプレート要素型に
 * 適合する場合だけ採用します。不正値と未知フィールドは無視します。
 */
function mergeKnownValues(base: unknown, override: unknown): unknown {
  if (override === undefined) return base;

  if (Array.isArray(base)) {
    const result = validateCompleteValue(base, override);
    return result.valid ? result.value : base;
  }

  if (!isRecord(base)) {
    return typeof override === typeof base ? override : base;
  }

  if (!isRecord(override)) {
    return base;
  }

  return Object.fromEntries(
    Object.entries(base).map(([key, value]) => [
      key,
      mergeKnownValues(value, override[key]),
    ])
  );
}

export function mergeCustomerConfig(
  base: CustomerConfig,
  override?: CustomerConfigOverride | null
): CustomerConfig {
  if (!override) return base;
  return mergeKnownValues(base, override) as CustomerConfig;
}

export function getDefaultCustomerConfig(): CustomerConfig {
  return CUSTOMER as unknown as CustomerConfig;
}

/**
 * 未知フィールドは無視し、指定された既知フィールドだけを実行時検証します。
 * 配列は各要素をテンプレート要素型まで再帰検証します。
 */
export function isValidCustomerConfigOverride(
  override: unknown
): override is CustomerConfigOverride {
  return isRecord(override) && validatePartialValue(CUSTOMER, override);
}

export function resolveCustomerConfig(
  override?: CustomerConfigOverride | null
): CustomerConfig {
  return mergeCustomerConfig(getDefaultCustomerConfig(), override);
}

export function getCustomerConfigOverride(
  documentData: unknown
): CustomerConfigOverride | null {
  if (!isRecord(documentData)) return null;

  const document = documentData as CustomerSiteDocument;
  return isRecord(document.config)
    ? document.config
    : (document as CustomerConfigOverride);
}

export function resolveCustomerConfigDocument(
  documentData: unknown
): CustomerConfig {
  return resolveCustomerConfig(getCustomerConfigOverride(documentData));
}
