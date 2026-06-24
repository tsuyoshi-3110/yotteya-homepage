export type VercelHostViewStatus =
  | "connection_complete"
  | "dns_pending"
  | "verification_pending"
  | "ssl_checking";

export const VERCEL_HOST_STATUS_VIEW: Record<
  VercelHostViewStatus,
  { label: string; tone: string }
> = {
  connection_complete: {
    label: "接続完了",
    tone: "border-emerald-300 bg-emerald-50 text-emerald-900",
  },
  dns_pending: {
    label: "DNS設定待ち",
    tone: "border-amber-300 bg-amber-50 text-amber-900",
  },
  verification_pending: {
    label: "検証待ち",
    tone: "border-orange-300 bg-orange-50 text-orange-900",
  },
  ssl_checking: {
    label: "SSL確認中",
    tone: "border-blue-300 bg-blue-50 text-blue-900",
  },
};

export function getVercelCheckButtonState(checking: boolean) {
  return {
    disabled: checking,
    label: checking ? "確認中…" : "Vercel接続状態を確認",
  };
}

type RecommendedRecord = {
  type: "A" | "CNAME";
  rank: number | null;
  value: string;
};

type VercelDnsHosts = {
  apex: { dns: { recommended: RecommendedRecord[] } };
  www: { dns: { recommended: RecommendedRecord[] } };
};

export function formatVercelDnsRecords(hosts: VercelDnsHosts) {
  const records = [
    ...hosts.apex.dns.recommended.flatMap((record) =>
      record.type === "A" && record.value
        ? [{ type: "A" as const, name: "@", value: record.value }]
        : [],
    ),
    ...hosts.www.dns.recommended.flatMap((record) =>
      record.type === "CNAME" && record.value
        ? [{ type: "CNAME" as const, name: "www", value: record.value }]
        : [],
    ),
  ];
  return records.filter(
    (record, index) =>
      records.findIndex(
        (candidate) =>
          candidate.type === record.type &&
          candidate.name === record.name &&
          candidate.value === record.value,
      ) === index,
  );
}

export function vercelCheckErrorMessage(status: number): string {
  if (status === 401) return "ログインが必要です。";
  if (status === 403) return "このサイトの状態を確認する権限がありません。";
  if (status === 404) return "確認する独自ドメインが設定されていません。";
  return "Vercelの接続状態を取得できませんでした。時間をおいて再度お試しください。";
}
