import { isValidAdminSiteKey } from "./admin-domain-settings.ts";
import { normalizeManagedDomain } from "./admin-domain-update.ts";
import {
  assessCurrentDomainConnection,
  type DomainConnectionStatus,
} from "./domain-settings-view.ts";
import {
  normalizeVercelHostStatus,
  type RawVercelHostStatus,
  VercelStatusUnavailableError,
} from "./vercel-domain-status.ts";
import { VercelClientError } from "./vercel-domain-client.ts";

type UnknownRecord = Record<string, unknown>;

export type DomainStatusSyncTransaction = {
  readOwnerId: (siteKey: string) => Promise<unknown>;
  readSite: (siteKey: string) => Promise<unknown | null>;
  mergeSite: (siteKey: string, patch: UnknownRecord) => void;
};

export type DomainStatusSyncDependencies = {
  readOwnerId: (siteKey: string) => Promise<unknown>;
  readSite: (siteKey: string) => Promise<unknown | null>;
  fetchHostStatus: (hostname: string) => Promise<RawVercelHostStatus>;
  checkedAtValue: () => unknown;
  runTransaction: <T>(
    operation: (transaction: DomainStatusSyncTransaction) => Promise<T>,
  ) => Promise<T>;
};

export type DomainStatusSyncResult = {
  status: 200 | 400 | 401 | 403 | 404 | 409 | 429 | 500 | 503;
  body: Record<string, unknown>;
};

const STATUS_REASON_CODES: Record<DomainConnectionStatus, string> = {
  unconfigured: "domain_unconfigured",
  pending_dns: "vercel_dns_or_verification_pending",
  pending_ssl: "vercel_ssl_pending",
  active: "vercel_required_hosts_ready",
  error: "vercel_state_inconsistent",
};

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function optionalBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function settingsSnapshot(site: UnknownRecord) {
  return {
    domain: optionalString(site.domain),
    canonicalHost: optionalString(site.canonicalHost),
    wwwEnabled: optionalBoolean(site.wwwEnabled),
  };
}

function isSameSettings(
  left: ReturnType<typeof settingsSnapshot>,
  right: ReturnType<typeof settingsSnapshot>,
) {
  return (
    left.domain === right.domain &&
    left.canonicalHost === right.canonicalHost &&
    left.wwwEnabled === right.wwwEnabled
  );
}

function unavailableStatus(error: unknown): 429 | 503 | null {
  if (
    error !== null &&
    typeof error === "object" &&
    "reason" in error &&
    "name" in error
  ) {
    const name = (error as { name: string }).name;
    if (
      name === "VercelStatusUnavailableError" ||
      name === "VercelClientError"
    ) {
      return (error as { reason: string }).reason === "upstream-429" ? 429 : 503;
    }
  }
  return null;
}

export async function syncAdminDomainStatus({
  siteKey,
  uid,
  dependencies,
}: {
  siteKey: unknown;
  uid: string | null;
  dependencies: DomainStatusSyncDependencies;
}): Promise<DomainStatusSyncResult> {
  if (!uid) {
    return { status: 401, body: { error: "unauthorized" } };
  }
  if (!isValidAdminSiteKey(siteKey)) {
    return { status: 400, body: { error: "invalid-site-key" } };
  }

  try {
    const ownerId = await dependencies.readOwnerId(siteKey);
    if (typeof ownerId !== "string" || ownerId !== uid) {
      return { status: 403, body: { error: "forbidden" } };
    }

    const siteValue = await dependencies.readSite(siteKey);
    const site = isRecord(siteValue) ? siteValue : {};
    const normalizedDomain = normalizeManagedDomain(site.domain);
    if (!normalizedDomain.ok) {
      return { status: 404, body: { error: "domain-settings-not-found" } };
    }

    const initialSettings = settingsSnapshot(site);
    const domain = normalizedDomain.hostname;
    let apexRaw: RawVercelHostStatus;
    let wwwRaw: RawVercelHostStatus;
    try {
      [apexRaw, wwwRaw] = await Promise.all([
        dependencies.fetchHostStatus(domain),
        dependencies.fetchHostStatus(`www.${domain}`),
      ]);
    } catch (error) {
      const status = unavailableStatus(error);
      if (status) {
        return {
          status,
          body: {
            error:
              status === 429
                ? "vercel-rate-limited"
                : "vercel-status-unavailable",
          },
        };
      }
      throw error;
    }

    const assessment = assessCurrentDomainConnection({
      domain,
      canonicalHost: initialSettings.canonicalHost,
      wwwEnabled: initialSettings.wwwEnabled === true,
      firestoreStatus: site.domainStatus,
      vercel: {
        kind: "success",
        data: {
          hosts: {
            apex: normalizeVercelHostStatus(domain, "apex", apexRaw),
            www: normalizeVercelHostStatus(
              `www.${domain}`,
              "www",
              wwwRaw,
            ),
          },
        },
      },
    });
    const domainStatus = assessment.status;
    const domainStatusReason = STATUS_REASON_CODES[domainStatus];

    return await dependencies.runTransaction(async (transaction) => {
      const transactionOwnerId = await transaction.readOwnerId(siteKey);
      if (
        typeof transactionOwnerId !== "string" ||
        transactionOwnerId !== uid
      ) {
        return { status: 403, body: { error: "forbidden" } };
      }

      const currentSiteValue = await transaction.readSite(siteKey);
      const currentSite = isRecord(currentSiteValue) ? currentSiteValue : {};
      if (!isSameSettings(initialSettings, settingsSnapshot(currentSite))) {
        return {
          status: 409,
          body: { error: "domain-settings-changed" },
        };
      }
      const changed =
        optionalString(currentSite.domainStatus) !== domainStatus ||
        optionalString(currentSite.domainStatusReason) !== domainStatusReason;

      transaction.mergeSite(siteKey, {
        domainStatus,
        domainStatusCheckedAt: dependencies.checkedAtValue(),
        domainStatusReason,
      });

      return {
        status: 200,
        body: {
          changed,
          checkedAtUpdated: true,
          siteKey,
          domainStatus,
          domainStatusReason,
          reason: assessment.reason,
        },
      };
    });
  } catch (error) {
    console.error(
      "admin domain status sync failed",
      error instanceof Error ? error.name : "unknown",
    );
    return { status: 500, body: { error: "internal" } };
  }
}
