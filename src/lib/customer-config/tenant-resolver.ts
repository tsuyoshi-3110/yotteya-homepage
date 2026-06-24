import { CUSTOMER } from "../../config/customer.ts";

type UnknownRecord = Record<string, unknown>;

export type TenantResolutionReason =
  | "domain-registry"
  | "invalid-host"
  | "local-fallback"
  | "preview-fallback"
  | "unregistered-domain"
  | "registry-error";

export type TenantResolution = {
  siteKey: string;
  hostname: string | null;
  reason: TenantResolutionReason;
  matchedDomain?: string;
};

export type ReadDomainDocument = (
  normalizedHostname: string
) => Promise<unknown | null>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidIpv4(hostname: string): boolean {
  const parts = hostname.split(".");
  return (
    parts.length === 4 &&
    parts.every((part) => {
      if (!/^\d{1,3}$/.test(part)) return false;
      const value = Number(part);
      return value >= 0 && value <= 255 && String(value) === String(Number(part));
    })
  );
}

function isValidDomain(hostname: string): boolean {
  if (hostname.length > 253 || !hostname.includes(".")) return false;
  return hostname.split(".").every(
    (label) =>
      label.length >= 1 &&
      label.length <= 63 &&
      /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)
  );
}

/**
 * Hostヘッダー用の厳格な正規化。
 * 小文字化し、ポートと末尾ドットを除去します。
 */
export function normalizeHostname(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) {
    return null;
  }

  if (
    value !== value.trim() ||
    /[\u0000-\u0020\u007f]/.test(value) ||
    /[\/\\?#@,]/.test(value) ||
    value.includes("://")
  ) {
    return null;
  }

  let hostname: string;
  try {
    hostname = new URL(`http://${value}`).hostname.toLowerCase();
  } catch {
    return null;
  }

  if (hostname.startsWith("[") && hostname.endsWith("]")) {
    hostname = hostname.slice(1, -1);
  }
  hostname = hostname.replace(/\.+$/, "");

  if (hostname === "localhost" || hostname === "::1") return hostname;
  if (isValidIpv4(hostname)) return hostname;
  return isValidDomain(hostname) ? hostname : null;
}

export function getDomainLookupCandidates(hostname: string): string[] {
  if (
    hostname === "localhost" ||
    hostname === "::1" ||
    isValidIpv4(hostname)
  ) {
    return [];
  }

  return hostname.startsWith("www.")
    ? [hostname, hostname.slice(4)]
    : [hostname, `www.${hostname}`];
}

function isPreviewHostname(hostname: string): boolean {
  return hostname === "vercel.app" || hostname.endsWith(".vercel.app");
}

function getRegisteredSiteKey(documentData: unknown): string | null {
  if (!isRecord(documentData)) return null;
  const siteKey = documentData.siteKey;
  return typeof siteKey === "string" &&
    siteKey.length > 0 &&
    siteKey.length <= 128 &&
    /^[A-Za-z0-9_-]+$/.test(siteKey)
    ? siteKey
    : null;
}

export async function resolveTenantSiteKey({
  host,
  fallbackSiteKey = CUSTOMER.siteKey,
  readDomainDocument,
}: {
  host: unknown;
  fallbackSiteKey?: string;
  readDomainDocument: ReadDomainDocument;
}): Promise<TenantResolution> {
  const hostname = normalizeHostname(host);

  if (!hostname) {
    return { siteKey: fallbackSiteKey, hostname: null, reason: "invalid-host" };
  }

  if (
    hostname === "localhost" ||
    hostname === "::1" ||
    isValidIpv4(hostname)
  ) {
    return { siteKey: fallbackSiteKey, hostname, reason: "local-fallback" };
  }

  if (isPreviewHostname(hostname)) {
    return { siteKey: fallbackSiteKey, hostname, reason: "preview-fallback" };
  }

  try {
    for (const candidate of getDomainLookupCandidates(hostname)) {
      const siteKey = getRegisteredSiteKey(
        await readDomainDocument(candidate)
      );
      if (siteKey) {
        return {
          siteKey,
          hostname,
          reason: "domain-registry",
          matchedDomain: candidate,
        };
      }
    }
  } catch {
    return { siteKey: fallbackSiteKey, hostname, reason: "registry-error" };
  }

  return {
    siteKey: fallbackSiteKey,
    hostname,
    reason: "unregistered-domain",
  };
}
