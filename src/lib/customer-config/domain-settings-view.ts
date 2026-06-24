export type DomainConnectionStatus =
  | "unconfigured"
  | "pending_dns"
  | "pending_ssl"
  | "active"
  | "error";

export const DOMAIN_STATUS_VIEW: Record<
  DomainConnectionStatus,
  { label: string; description: string; tone: string }
> = {
  unconfigured: {
    label: "未設定",
    description: "独自ドメインはまだ設定されていません。",
    tone: "border-gray-300 bg-gray-50 text-gray-700",
  },
  pending_dns: {
    label: "DNS確認中",
    description: "DNSレコードの反映を確認しています。",
    tone: "border-amber-300 bg-amber-50 text-amber-800",
  },
  pending_ssl: {
    label: "SSL発行中",
    description: "HTTPS証明書の発行を待っています。",
    tone: "border-blue-300 bg-blue-50 text-blue-800",
  },
  active: {
    label: "接続完了",
    description: "独自ドメインで安全に公開されています。",
    tone: "border-emerald-300 bg-emerald-50 text-emerald-800",
  },
  error: {
    label: "設定エラー",
    description: "DNS設定またはドメイン接続に問題があります。",
    tone: "border-red-300 bg-red-50 text-red-800",
  },
};

export function normalizeDomainConnectionStatus(
  value: unknown
): DomainConnectionStatus {
  return typeof value === "string" && value in DOMAIN_STATUS_VIEW
    ? (value as DomainConnectionStatus)
    : "unconfigured";
}

type CurrentHostStatus = {
  hostname: string;
  status: string;
  configured: boolean;
  verified: boolean;
  misconfigured: boolean;
  redirect: { target: string | null };
  ssl: { status: string };
};

type CurrentVercelState =
  | { kind: "not_requested" }
  | { kind: "error" }
  | {
      kind: "success";
      data: {
        hosts: {
          apex: CurrentHostStatus;
          www: CurrentHostStatus;
        };
      };
    };

function normalizeHostname(value: string | null): string | null {
  if (!value) return null;
  return value.trim().toLowerCase().replace(/\.$/, "") || null;
}

export function assessCurrentDomainConnection({
  domain,
  canonicalHost,
  wwwEnabled,
  firestoreStatus,
  vercel,
}: {
  domain: string | null;
  canonicalHost: string | null;
  wwwEnabled: boolean;
  firestoreStatus: unknown;
  vercel: CurrentVercelState;
}): {
  status: DomainConnectionStatus;
  source: "firestore" | "vercel";
  reason: string;
} {
  const normalizedDomain = normalizeHostname(domain);
  if (!normalizedDomain) {
    return {
      status: "unconfigured",
      source: "firestore",
      reason: "独自ドメインが設定されていません。",
    };
  }

  if (vercel.kind === "not_requested") {
    return {
      status: normalizeDomainConnectionStatus(firestoreStatus),
      source: "firestore",
      reason:
        "Vercelの現在状態は未確認です。保存済みの接続状態を表示しています。",
    };
  }

  if (vercel.kind === "error") {
    return {
      status: "error",
      source: "vercel",
      reason:
        "Vercelの現在状態を取得できなかったため、自動判定できません。",
    };
  }

  const normalizedCanonical = normalizeHostname(canonicalHost);
  if (!normalizedCanonical) {
    return {
      status: "error",
      source: "vercel",
      reason: "正規ドメインが設定されていないため判定できません。",
    };
  }

  const requiredHosts = [vercel.data.hosts.apex];
  if (wwwEnabled) requiredHosts.push(vercel.data.hosts.www);
  const expectedHostnames = [
    normalizedDomain,
    ...(wwwEnabled ? [`www.${normalizedDomain}`] : []),
  ];

  const hostnameMismatch = requiredHosts.some(
    (host, index) =>
      normalizeHostname(host.hostname) !== expectedHostnames[index],
  );
  if (hostnameMismatch) {
    return {
      status: "error",
      source: "vercel",
      reason: "Vercelのホスト名と保存済みドメインが一致しません。",
    };
  }

  const redirectMismatch = requiredHosts.some((host) => {
    const target = normalizeHostname(host.redirect.target);
    return target !== null && target !== normalizedCanonical;
  });
  if (redirectMismatch) {
    return {
      status: "error",
      source: "vercel",
      reason: "Vercelのリダイレクト先が正規ドメインと一致しません。",
    };
  }

  const contradictory = requiredHosts.some(
    (host) =>
      host.status === "connection_complete" &&
      (!host.configured ||
        !host.verified ||
        host.misconfigured ||
        host.ssl.status !== "ready"),
  );
  if (contradictory) {
    return {
      status: "error",
      source: "vercel",
      reason: "Vercelの接続状態に矛盾があるため判定できません。",
    };
  }

  const pendingDns = requiredHosts.some(
    (host) =>
      !host.verified ||
      !host.configured ||
      host.misconfigured ||
      host.status === "verification_pending" ||
      host.status === "dns_pending" ||
      host.ssl.status === "verification_pending" ||
      host.ssl.status === "dns_pending",
  );
  if (pendingDns) {
    return {
      status: "pending_dns",
      source: "vercel",
      reason: "DNS設定またはドメイン検証の完了を待っています。",
    };
  }

  const pendingSsl = requiredHosts.some(
    (host) =>
      host.ssl.status !== "ready" || host.status === "ssl_checking",
  );
  if (pendingSsl) {
    return {
      status: "pending_ssl",
      source: "vercel",
      reason: "DNSは正常です。SSL証明書の確認完了を待っています。",
    };
  }

  const active = requiredHosts.every(
    (host) =>
      host.status === "connection_complete" &&
      host.configured &&
      host.verified &&
      !host.misconfigured &&
      host.ssl.status === "ready",
  );
  if (active) {
    return {
      status: "active",
      source: "vercel",
      reason:
        "必要なホストのDNS・SSL・リダイレクト状態がすべて正常です。",
    };
  }

  return {
    status: "error",
    source: "vercel",
    reason: "Vercelの状態を安全に判定できない組み合わせです。",
  };
}

export function domainSettingsErrorMessage(status: number): string {
  if (status === 401) return "ログインが必要です。管理者ログイン後に再度お試しください。";
  if (status === 403) return "このサイトの独自ドメイン情報を表示する権限がありません。";
  if (status === 404) return "独自ドメインは未設定です。";
  return "独自ドメイン情報を取得できませんでした。時間をおいて再度お試しください。";
}
