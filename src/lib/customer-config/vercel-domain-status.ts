import { isIP } from "node:net";
import { domainToASCII } from "node:url";
import { normalizeManagedDomain } from "./admin-domain-update.ts";
import { isValidAdminSiteKey } from "./admin-domain-settings.ts";
import { VercelClientError } from "./vercel-domain-client.ts";

type UnknownRecord = Record<string, unknown>;

export type RawVercelHostStatus = {
  projectDomain: unknown;
  config: unknown;
};

export type VercelDomainStatusDependencies = {
  readOwnerId: (siteKey: string) => Promise<unknown>;
  readSite: (siteKey: string) => Promise<unknown | null>;
  fetchHostStatus: (hostname: string) => Promise<RawVercelHostStatus>;
};

export type VercelDomainStatusResult = {
  status: 200 | 400 | 401 | 403 | 404 | 503;
  body: Record<string, unknown>;
};

export class VercelStatusUnavailableError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super("Vercel domain status is unavailable");
    this.name = "VercelStatusUnavailableError";
    this.reason = reason;
  }
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function optionalBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function optionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function sanitizeVerification(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const type = optionalString(item.type);
    const domain = optionalString(item.domain);
    const recordValue = optionalString(item.value);
    const reason = optionalString(item.reason);
    if (!type || !domain || !recordValue) return [];
    return [{ type, domain, value: recordValue, reason }];
  });
}

function sanitizeRecommendedA(value: unknown) {
  if (!Array.isArray(value)) return [];
  const records = value
    .flatMap((item) => {
      if (!isRecord(item)) return [];
      const rank = optionalNumber(item.rank);
      return stringArray(item.value).flatMap((recordValue) =>
        isIP(recordValue) === 4
          ? [{ type: "A" as const, rank, value: recordValue }]
          : [],
      );
    })
    .sort((left, right) => (left.rank ?? 999) - (right.rank ?? 999));
  return records.filter(
    (record, index) =>
      records.findIndex(({ value: candidate }) => candidate === record.value) ===
      index,
  );
}

function normalizeCname(value: string): string | null {
  const trailingDot = value.endsWith(".");
  const hostname = trailingDot ? value.slice(0, -1) : value;
  if (
    !hostname ||
    hostname.length > 253 ||
    /[/:?#@\\[\]\s_]/.test(hostname)
  ) {
    return null;
  }
  const ascii = domainToASCII(hostname).toLowerCase();
  if (
    !ascii ||
    !ascii.includes(".") ||
    ascii.split(".").some(
      (label) =>
        label.length < 1 ||
        label.length > 63 ||
        !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label),
    )
  ) {
    return null;
  }
  return `${ascii}${trailingDot ? "." : ""}`;
}

function sanitizeRecommendedCname(value: unknown) {
  if (!Array.isArray(value)) return [];
  const records = value
    .flatMap((item) => {
      if (!isRecord(item)) return [];
      const recordValue = optionalString(item.value);
      if (!recordValue) return [];
      const normalized = normalizeCname(recordValue);
      if (!normalized) return [];
      return [
        {
          type: "CNAME" as const,
          rank: optionalNumber(item.rank),
          value: normalized,
        },
      ];
    })
    .sort((left, right) => (left.rank ?? 999) - (right.rank ?? 999));
  return records.filter((record, index) => {
    const comparable = record.value.replace(/\.$/, "");
    return (
      records.findIndex(
        ({ value: candidate }) =>
          candidate.replace(/\.$/, "") === comparable,
      ) === index
    );
  });
}

export function normalizeVercelHostStatus(
  hostname: string,
  kind: "apex" | "www",
  raw: RawVercelHostStatus,
) {
  const projectDomain = isRecord(raw.projectDomain) ? raw.projectDomain : {};
  const config = isRecord(raw.config) ? raw.config : {};
  const verified = optionalBoolean(projectDomain.verified) === true;
  const misconfigured = optionalBoolean(config.misconfigured) !== false;
  const configuredBy = optionalString(config.configuredBy);
  const configured = configuredBy !== null && !misconfigured;
  const acceptedChallenges = stringArray(config.acceptedChallenges);
  const verification = sanitizeVerification(projectDomain.verification);

  const status = !verified
    ? "verification_pending"
    : misconfigured || !configuredBy
      ? "dns_pending"
      : acceptedChallenges.length === 0
        ? "ssl_checking"
        : "connection_complete";

  return {
    hostname,
    kind,
    status,
    configured,
    verified,
    misconfigured,
    verification,
    redirect: {
      target: optionalString(projectDomain.redirect),
      statusCode: optionalNumber(projectDomain.redirectStatusCode),
    },
    dns: {
      configuredBy,
      recommended:
        kind === "apex"
          ? sanitizeRecommendedA(config.recommendedIPv4)
          : sanitizeRecommendedCname(config.recommendedCNAME),
    },
    ssl: {
      status: !verified
        ? "verification_pending"
        : misconfigured || !configuredBy
          ? "dns_pending"
          : acceptedChallenges.length === 0
            ? "checking"
            : "ready",
      acceptedChallenges,
    },
  };
}

export async function getAdminVercelDomainStatus({
  siteKey,
  uid,
  dependencies,
}: {
  siteKey: unknown;
  uid: string | null;
  dependencies: VercelDomainStatusDependencies;
}): Promise<VercelDomainStatusResult> {
  if (!uid) {
    return { status: 401, body: { error: "unauthorized" } };
  }
  if (!isValidAdminSiteKey(siteKey)) {
    return { status: 400, body: { error: "invalid-site-key" } };
  }

  const ownerId = await dependencies.readOwnerId(siteKey);
  if (typeof ownerId !== "string" || ownerId !== uid) {
    return { status: 403, body: { error: "forbidden" } };
  }

  const siteValue = await dependencies.readSite(siteKey);
  const site = isRecord(siteValue) ? siteValue : {};
  const normalized = normalizeManagedDomain(site.domain);
  if (!normalized.ok) {
    return { status: 404, body: { error: "domain-settings-not-found" } };
  }

  const domain = normalized.hostname;
  const wwwEnabled = optionalBoolean(site.wwwEnabled);
  try {
    const [apexRaw, wwwRaw] = await Promise.all([
      dependencies.fetchHostStatus(domain),
      dependencies.fetchHostStatus(`www.${domain}`),
    ]);
    const apex = normalizeVercelHostStatus(domain, "apex", apexRaw);
    const www = normalizeVercelHostStatus(`www.${domain}`, "www", wwwRaw);
    const hosts = [apex, www];

    return {
      status: 200,
      body: {
        siteKey,
        domain,
        wwwEnabled,
        status: hosts.every(({ status }) => status === "connection_complete")
          ? "connection_complete"
          : hosts.some(({ status }) => status === "verification_pending")
            ? "verification_pending"
            : hosts.some(({ status }) => status === "dns_pending")
              ? "dns_pending"
              : "ssl_checking",
        configured: hosts.every(({ configured }) => configured),
        verified: hosts.every(({ verified }) => verified),
        misconfigured: hosts.some(({ misconfigured }) => misconfigured),
        hosts: { apex, www },
      },
    };
  } catch (error) {
    if (
      error instanceof VercelClientError ||
      error instanceof VercelStatusUnavailableError
    ) {
      return {
        status: 503,
        body: { error: "vercel-status-unavailable" },
      };
    }
    return {
      status: 503,
      body: { error: "vercel-status-unavailable" },
    };
  }
}
