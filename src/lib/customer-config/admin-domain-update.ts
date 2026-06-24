import { isIP } from "node:net";
import { domainToASCII } from "node:url";
import { isValidAdminSiteKey } from "./admin-domain-settings.ts";

type UnknownRecord = Record<string, unknown>;

export type DomainUpdateTransaction = {
  readOwnerId: (siteKey: string) => Promise<unknown>;
  readSite: (siteKey: string) => Promise<unknown | null>;
  readDomain: (hostname: string) => Promise<unknown | null>;
  mergeSite: (siteKey: string, patch: UnknownRecord) => void;
  mergeDomain: (hostname: string, patch: UnknownRecord) => void;
};

export type DomainUpdateDependencies = {
  runTransaction: <T>(
    operation: (transaction: DomainUpdateTransaction) => Promise<T>,
  ) => Promise<T>;
};

export type DomainUpdateResult = {
  status: 200 | 400 | 401 | 403 | 409 | 500;
  body: Record<string, unknown>;
};

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function normalizeManagedDomain(
  value: unknown,
): { ok: true; hostname: string } | { ok: false; error: string } {
  if (typeof value !== "string") {
    return { ok: false, error: "domain-required" };
  }

  const trimmed = value.trim();
  if (
    !trimmed ||
    trimmed.length > 254 ||
    /\s/.test(trimmed) ||
    /[/:?#@\\[\]]/.test(trimmed)
  ) {
    return { ok: false, error: "invalid-domain" };
  }

  const withoutTrailingDot = trimmed.endsWith(".")
    ? trimmed.slice(0, -1)
    : trimmed;
  if (!withoutTrailingDot || withoutTrailingDot.endsWith(".")) {
    return { ok: false, error: "invalid-domain" };
  }

  const hostname = domainToASCII(withoutTrailingDot).toLowerCase();
  if (
    !hostname ||
    hostname.length > 253 ||
    !hostname.includes(".") ||
    hostname.startsWith("www.") ||
    isIP(hostname) !== 0 ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "vercel.app" ||
    hostname.endsWith(".vercel.app")
  ) {
    return { ok: false, error: "invalid-domain" };
  }

  const labels = hostname.split(".");
  if (
    labels.some(
      (label) =>
        label.length < 1 ||
        label.length > 63 ||
        !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label),
    )
  ) {
    return { ok: false, error: "invalid-domain" };
  }

  return { ok: true, hostname };
}

function parseInput(input: unknown):
  | { ok: true; domain: string; wwwEnabled: boolean }
  | { ok: false; error: string } {
  if (!isRecord(input) || typeof input.wwwEnabled !== "boolean") {
    return { ok: false, error: "invalid-request" };
  }
  const normalized = normalizeManagedDomain(input.domain);
  if (!normalized.ok) return normalized;
  return {
    ok: true,
    domain: normalized.hostname,
    wwwEnabled: input.wwwEnabled,
  };
}

export async function updateAdminDomainSettings({
  siteKey,
  uid,
  input,
  dependencies,
}: {
  siteKey: unknown;
  uid: string | null;
  input: unknown;
  dependencies: DomainUpdateDependencies;
}): Promise<DomainUpdateResult> {
  if (!uid) {
    return { status: 401, body: { error: "unauthorized" } };
  }
  if (!isValidAdminSiteKey(siteKey)) {
    return { status: 400, body: { error: "invalid-site-key" } };
  }

  const parsed = parseInput(input);
  if (!parsed.ok) {
    return { status: 400, body: { error: parsed.error } };
  }

  const { domain, wwwEnabled } = parsed;
  const hostnames = wwwEnabled ? [domain, `www.${domain}`] : [domain];
  const patch = {
    domain,
    canonicalHost: domain,
    wwwEnabled,
    domainStatus: "pending_dns",
  };

  try {
    return await dependencies.runTransaction(
      async (transaction): Promise<DomainUpdateResult> => {
        const ownerId = await transaction.readOwnerId(siteKey);
        if (typeof ownerId !== "string" || ownerId !== uid) {
          return { status: 403, body: { error: "forbidden" } };
        }

        const siteValue = await transaction.readSite(siteKey);
        const site = isRecord(siteValue) ? siteValue : {};
        const currentDomain = optionalString(site.domain);
        const normalizedCurrentDomain = currentDomain
          ? normalizeManagedDomain(currentDomain)
          : null;
        const currentWwwEnabled =
          typeof site.wwwEnabled === "boolean" ? site.wwwEnabled : null;

        if (
          normalizedCurrentDomain?.ok &&
          normalizedCurrentDomain.hostname === domain &&
          currentWwwEnabled === wwwEnabled
        ) {
          return {
            status: 200,
            body: {
              changed: false,
              siteKey,
              domain: currentDomain,
              canonicalHost: optionalString(site.canonicalHost),
              wwwEnabled: currentWwwEnabled,
              domainStatus: optionalString(site.domainStatus),
              domains: wwwEnabled ? [domain, `www.${domain}`] : [domain],
            },
          };
        }

        const domainDocuments = await Promise.all(
          hostnames.map((hostname) => transaction.readDomain(hostname)),
        );
        const conflict = domainDocuments.some((document) => {
          if (!isRecord(document)) return false;
          const assignedSiteKey = document.siteKey;
          return (
            typeof assignedSiteKey === "string" &&
            assignedSiteKey.length > 0 &&
            assignedSiteKey !== siteKey
          );
        });
        if (conflict) {
          return {
            status: 409,
            body: { error: "domain-assigned-to-another-site" },
          };
        }

        transaction.mergeSite(siteKey, patch);
        for (const hostname of hostnames) {
          transaction.mergeDomain(hostname, { siteKey, ...patch });
        }

        return {
          status: 200,
          body: {
            changed: true,
            siteKey,
            ...patch,
            domains: hostnames,
          },
        };
      },
    );
  } catch (error) {
    console.error("admin domain settings update failed", error);
    return { status: 500, body: { error: "internal" } };
  }
}
