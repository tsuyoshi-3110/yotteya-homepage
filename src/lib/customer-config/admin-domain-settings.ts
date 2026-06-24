type UnknownRecord = Record<string, unknown>;

export const DOMAIN_DNS_REFERENCE = Object.freeze({
  notice: "現在のyotteya.shopで確認した値",
  records: [
    {
      type: "A",
      name: "@",
      value: "216.198.79.1",
    },
    {
      type: "CNAME",
      name: "www",
      value: "675cef4eac0f0603.vercel-dns-017.com",
    },
  ],
});

export type DomainDocument = {
  id: string;
  data: unknown;
};

export type DomainSettingsDependencies = {
  readOwnerId: (siteKey: string) => Promise<unknown>;
  readSite: (siteKey: string) => Promise<unknown | null>;
  readDomains: (siteKey: string) => Promise<DomainDocument[]>;
};

export type DomainSettingsResult = {
  status: 200 | 400 | 401 | 403 | 404;
  body: Record<string, unknown>;
};

export type DomainAuthenticationDependencies = {
  verifyIdToken: (token: string) => Promise<{ uid: string }>;
  verifySessionCookie: (session: string) => Promise<{ uid: string }>;
};

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isValidAdminSiteKey(siteKey: unknown): siteKey is string {
  return (
    typeof siteKey === "string" &&
    siteKey.length >= 1 &&
    siteKey.length <= 128 &&
    /^[A-Za-z0-9_-]+$/.test(siteKey)
  );
}

export async function authenticateAdminDomainRequest({
  authorization,
  session,
  dependencies,
}: {
  authorization: string | null;
  session: string | null;
  dependencies: DomainAuthenticationDependencies;
}): Promise<string | null> {
  if (authorization?.startsWith("Bearer ")) {
    const token = authorization.slice(7);
    if (!token) return null;
    try {
      return (await dependencies.verifyIdToken(token)).uid;
    } catch {
      return null;
    }
  }

  if (!session) return null;
  try {
    return (await dependencies.verifySessionCookie(session)).uid;
  } catch {
    return null;
  }
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function optionalBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function sanitizeDomainDocument(document: DomainDocument) {
  const data = isRecord(document.data) ? document.data : {};
  return {
    hostname: document.id,
    siteKey: optionalString(data.siteKey),
    domain: optionalString(data.domain),
    canonicalHost: optionalString(data.canonicalHost),
    wwwEnabled: optionalBoolean(data.wwwEnabled),
    domainStatus: optionalString(data.domainStatus),
  };
}

export async function getAdminDomainSettings({
  siteKey,
  uid,
  dependencies,
}: {
  siteKey: unknown;
  uid: string | null;
  dependencies: DomainSettingsDependencies;
}): Promise<DomainSettingsResult> {
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

  const [siteData, domainDocuments] = await Promise.all([
    dependencies.readSite(siteKey),
    dependencies.readDomains(siteKey),
  ]);
  const site = isRecord(siteData) ? siteData : {};
  const domains = domainDocuments.map(sanitizeDomainDocument);

  const domain = optionalString(site.domain);
  const canonicalHost = optionalString(site.canonicalHost);
  const wwwEnabled = optionalBoolean(site.wwwEnabled);
  const domainStatus = optionalString(site.domainStatus);

  if (
    !domain &&
    !canonicalHost &&
    wwwEnabled === null &&
    !domainStatus &&
    domains.length === 0
  ) {
    return { status: 404, body: { error: "domain-settings-not-found" } };
  }

  return {
    status: 200,
    body: {
      siteKey,
      domain,
      canonicalHost,
      wwwEnabled,
      domainStatus,
      domains,
      dns: DOMAIN_DNS_REFERENCE,
    },
  };
}
