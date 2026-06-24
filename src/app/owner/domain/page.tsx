"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Globe2,
  RefreshCw,
  Server,
} from "lucide-react";
import { auth } from "@/lib/firebase";
import { useSiteKey } from "@/lib/atoms/siteKeyAtom";
import {
  assessCurrentDomainConnection,
  DOMAIN_STATUS_VIEW,
  domainSettingsErrorMessage,
  normalizeDomainConnectionStatus,
} from "@/lib/customer-config/domain-settings-view";
import {
  domainSaveMessage,
  getDomainSaveButtonState,
} from "@/lib/customer-config/domain-settings-form";
import {
  domainStatusSyncMessage,
  getDomainStatusSyncButtonState,
} from "@/lib/customer-config/domain-status-sync-view";
import {
  formatVercelDnsRecords,
  getVercelCheckButtonState,
  vercelCheckErrorMessage,
  VERCEL_HOST_STATUS_VIEW,
  type VercelHostViewStatus,
} from "@/lib/customer-config/vercel-domain-status-view";

type DnsRecord = {
  type: "A" | "CNAME";
  name: string;
  value: string;
};

type DomainSettingsResponse = {
  siteKey: string;
  domain: string | null;
  canonicalHost: string | null;
  wwwEnabled: boolean | null;
  domainStatus: string | null;
  domains: Array<{ hostname: string }>;
  dns: {
    notice: string;
    records: DnsRecord[];
  } | null;
};

type ViewState =
  | { kind: "loading" }
  | { kind: "error"; status: number; message: string }
  | { kind: "ready"; data: DomainSettingsResponse };

type VercelRecommendedRecord = {
  type: "A" | "CNAME";
  rank: number | null;
  value: string;
};

type VercelHostStatus = {
  hostname: string;
  kind: "apex" | "www";
  status: VercelHostViewStatus;
  configured: boolean;
  verified: boolean;
  misconfigured: boolean;
  verification: Array<{
    type: string;
    domain: string;
    value: string;
    reason: string | null;
  }>;
  redirect: {
    target: string | null;
    statusCode: number | null;
  };
  dns: {
    configuredBy: string | null;
    recommended: VercelRecommendedRecord[];
  };
  ssl: {
    status: "ready" | "checking" | "dns_pending" | "verification_pending";
    acceptedChallenges: string[];
  };
};

type VercelStatusResponse = {
  siteKey: string;
  domain: string;
  wwwEnabled: boolean | null;
  status: VercelHostViewStatus;
  configured: boolean;
  verified: boolean;
  misconfigured: boolean;
  hosts: {
    apex: VercelHostStatus;
    www: VercelHostStatus;
  };
};

type VercelCheckState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "success"; data: VercelStatusResponse }
  | { kind: "error"; message: string };

type DomainStatusSyncState =
  | { kind: "idle" }
  | { kind: "confirming" }
  | { kind: "syncing" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

/**
 * このページのDNS値はAPIが返す「現在のyotteya.shopで確認した値」の表示専用です。
 * 将来の他テナントへ固定値として流用したり、ブラウザ側から設定へ書き戻したりしません。
 */
export default function OwnerDomainSettingsPage() {
  const siteKey = useSiteKey();
  const [state, setState] = useState<ViewState>({ kind: "loading" });
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setState({ kind: "loading" });
      try {
        const token = user ? await user.getIdToken() : null;
        const response = await fetch(`/api/admin/sites/${siteKey}/domain`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          cache: "no-store",
        });
        const body = await response.json().catch(() => null);
        if (!active) return;

        if (!response.ok) {
          if (response.status === 404) {
            setState({
              kind: "ready",
              data: {
                siteKey: siteKey,
                domain: null,
                canonicalHost: null,
                wwwEnabled: false,
                domainStatus: "unconfigured",
                domains: [],
                dns: null,
              },
            });
            return;
          }
          setState({
            kind: "error",
            status: response.status,
            message: domainSettingsErrorMessage(response.status),
          });
          return;
        }

        setState({ kind: "ready", data: body as DomainSettingsResponse });
      } catch {
        if (!active) return;
        setState({
          kind: "error",
          status: 0,
          message: domainSettingsErrorMessage(0),
        });
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const copyValue = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      setCopied(null);
    }
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-6">
        <Link href="/login" className="text-sm text-blue-700 hover:underline">
          ← 管理画面へ戻る
        </Link>
        <div className="mt-4 flex items-start gap-3">
          <Globe2 className="mt-1 h-7 w-7 shrink-0 text-blue-700" />
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">独自ドメイン設定</h1>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              現在の接続状態とDNS設定を確認し、独自ドメインを安全に変更できます。
            </p>
          </div>
        </div>
      </div>

      {state.kind === "loading" && (
        <div
          className="rounded-2xl border bg-white/80 p-6 shadow-sm"
          aria-live="polite"
        >
          <div className="h-5 w-40 animate-pulse rounded bg-gray-200" />
          <div className="mt-4 h-20 animate-pulse rounded-xl bg-gray-100" />
          <p className="mt-4 text-sm text-gray-600">読み込み中…</p>
        </div>
      )}

      {state.kind === "error" && (
        <div
          className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800"
          role="alert"
        >
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <div>
              <h2 className="font-semibold" style={{ color: "#7f1d1d" }}>
                {state.status === 404 ? "独自ドメイン未設定" : "表示できません"}
              </h2>
              <p className="mt-1 text-sm leading-6">{state.message}</p>
              {state.status === 401 && (
                <Link
                  href="/login"
                  className="mt-3 inline-block rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white"
                >
                  管理者ログインへ
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {state.kind === "ready" && (
        <DomainSettingsView
          data={state.data}
          copied={copied}
          onCopy={copyValue}
          onSaved={(saved) => {
            setState((current) => {
              if (current.kind !== "ready") return current;
              const savedHostnames = saved.domains.map((hostname) => ({
                hostname,
              }));
              const domains = [
                ...current.data.domains,
                ...savedHostnames,
              ].filter(
                (item, index, items) =>
                  items.findIndex(
                    ({ hostname }) => hostname === item.hostname
                  ) === index
              );
              return {
                kind: "ready",
                data: {
                  ...current.data,
                  domain: saved.domain,
                  canonicalHost: saved.canonicalHost,
                  wwwEnabled: saved.wwwEnabled,
                  domainStatus: saved.domainStatus,
                  domains,
                },
              };
            });
          }}
          onReloaded={(reloaded) => {
            setState({ kind: "ready", data: reloaded });
          }}
        />
      )}
    </main>
  );
}

function DomainSettingsView({
  data,
  copied,
  onCopy,
  onSaved,
  onReloaded,
}: {
  data: DomainSettingsResponse;
  copied: string | null;
  onCopy: (key: string, value: string) => void;
  onSaved: (saved: {
    changed: boolean;
    domain: string;
    canonicalHost: string | null;
    wwwEnabled: boolean;
    domainStatus: string | null;
    domains: string[];
  }) => void;
  onReloaded: (reloaded: DomainSettingsResponse) => void;
}) {
  const siteKey = useSiteKey();
  const savedStatus = normalizeDomainConnectionStatus(data.domainStatus);
  const savedStatusView = DOMAIN_STATUS_VIEW[savedStatus];
  const [domain, setDomain] = useState(data.domain ?? "");
  const [wwwEnabled, setWwwEnabled] = useState(data.wwwEnabled === true);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{
    status: number;
    message: string;
  } | null>(null);
  const [vercelState, setVercelState] = useState<VercelCheckState>({
    kind: "idle",
  });
  const [syncState, setSyncState] = useState<DomainStatusSyncState>({
    kind: "idle",
  });
  const [deletingHostname, setDeletingHostname] = useState<string | null>(null);
  const dirty =
    domain !== (data.domain ?? "") || wwwEnabled !== (data.wwwEnabled === true);
  const saveButton = getDomainSaveButtonState({ saving, dirty });

  const deleteHost = async (hostname: string) => {
    if (deletingHostname) return;
    if (!window.confirm(`「${hostname}」を登録ホストから削除しますか？`)) return;
    setDeletingHostname(hostname);
    try {
      const user = auth.currentUser;
      const token = user ? await user.getIdToken() : null;
      const res = await fetch(
        `/api/admin/sites/${siteKey}/domain?hostname=${encodeURIComponent(hostname)}`,
        {
          method: "DELETE",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          cache: "no-store",
        }
      );
      if (!res.ok) return;
      const reloadRes = await fetch(`/api/admin/sites/${siteKey}/domain`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        cache: "no-store",
      });
      const reloaded = await reloadRes.json().catch(() => null);
      if (reloadRes.ok && reloaded) onReloaded(reloaded as DomainSettingsResponse);
    } finally {
      setDeletingHostname(null);
    }
  };

  useEffect(() => {
    setDomain(data.domain ?? "");
    setWwwEnabled(data.wwwEnabled === true);
    setConfirming(false);
    setVercelState({ kind: "idle" });
    setSyncState({ kind: "idle" });
  }, [data.domain, data.wwwEnabled]);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setSaveResult(null);
    try {
      const user = auth.currentUser;
      const token = user ? await user.getIdToken() : null;
      const response = await fetch(`/api/admin/sites/${siteKey}/domain`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ domain, wwwEnabled }),
        cache: "no-store",
      });
      const body = await response.json().catch(() => null);
      const message = domainSaveMessage(response.status, body?.changed);
      setSaveResult({ status: response.status, message });

      if (response.ok && body) {
        onSaved(body);
        setConfirming(false);
      }
    } catch {
      setSaveResult({ status: 500, message: domainSaveMessage(500) });
    } finally {
      setSaving(false);
    }
  };

  const checkVercelStatus = async () => {
    if (
      vercelState.kind === "checking" ||
      syncState.kind === "syncing"
    ) return;
    setVercelState({ kind: "checking" });
    try {
      const user = auth.currentUser;
      const token = user ? await user.getIdToken() : null;
      const response = await fetch(
        `/api/admin/sites/${siteKey}/domain/vercel-status`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          cache: "no-store",
        },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok || !body) {
        setVercelState({
          kind: "error",
          message: vercelCheckErrorMessage(response.status),
        });
        return;
      }
      setVercelState({
        kind: "success",
        data: body as VercelStatusResponse,
      });
    } catch {
      setVercelState({
        kind: "error",
        message: vercelCheckErrorMessage(503),
      });
    }
  };

  const syncDomainStatus = async () => {
    if (syncState.kind === "syncing") return;
    setSyncState({ kind: "syncing" });
    try {
      const user = auth.currentUser;
      const token = user ? await user.getIdToken() : null;
      const response = await fetch(
        `/api/admin/sites/${siteKey}/domain/sync-status`,
        {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          cache: "no-store",
        },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setSyncState({
          kind: "error",
          message: domainStatusSyncMessage(response.status),
        });
        return;
      }

      const reloadResponse = await fetch(
        `/api/admin/sites/${siteKey}/domain`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          cache: "no-store",
        },
      );
      const reloaded = await reloadResponse.json().catch(() => null);
      if (!reloadResponse.ok || !reloaded) {
        setSyncState({
          kind: "error",
          message:
            "同期は完了しましたが、保存済み状態を再取得できませんでした。ページを再読み込みしてください。",
        });
        return;
      }

      onReloaded(reloaded as DomainSettingsResponse);
      setSyncState({
        kind: "success",
        message: domainStatusSyncMessage(200, body?.changed),
      });
    } catch {
      setSyncState({
        kind: "error",
        message: domainStatusSyncMessage(500),
      });
    }
  };

  const vercelButton = getVercelCheckButtonState(
    vercelState.kind === "checking",
  );
  const syncButton = getDomainStatusSyncButtonState({
    syncing: syncState.kind === "syncing",
    checking: vercelState.kind === "checking",
  });
  const vercelDnsRecords =
    vercelState.kind === "success"
      ? formatVercelDnsRecords(vercelState.data.hosts)
      : [];
  const displayedDnsRecords =
    vercelState.kind === "success"
      ? vercelDnsRecords
      : (data.dns?.records ?? []);
  const currentAssessment = assessCurrentDomainConnection({
    domain: data.domain,
    canonicalHost: data.canonicalHost,
    wwwEnabled: data.wwwEnabled === true,
    firestoreStatus: data.domainStatus,
    vercel:
      vercelState.kind === "success"
        ? { kind: "success", data: vercelState.data }
        : vercelState.kind === "error"
          ? { kind: "error" }
          : { kind: "not_requested" },
  });
  const currentStatusView = DOMAIN_STATUS_VIEW[currentAssessment.status];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <section
          className={`rounded-2xl border p-5 ${savedStatusView.tone}`}
        >
          <div className="flex items-start gap-3">
            {savedStatus === "active" ? (
              <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0" />
            ) : (
              <Server className="mt-0.5 h-6 w-6 shrink-0" />
            )}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide">
                保存済み状態
              </p>
              <h2
                className="mt-1 text-xl font-bold"
                style={{ color: "inherit" }}
              >
                {savedStatusView.label}
              </h2>
              <p className="mt-1 text-sm leading-6">
                Firestoreに保存されている状態です。Vercel確認では変更されません。
              </p>
            </div>
          </div>
        </section>

        <section
          className={`rounded-2xl border p-5 ${currentStatusView.tone}`}
        >
          <div className="flex items-start gap-3">
            {currentAssessment.status === "active" ? (
              <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0" />
            ) : (
              <Server className="mt-0.5 h-6 w-6 shrink-0" />
            )}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide">
                現在の接続判定
              </p>
              <h2
                className="mt-1 text-xl font-bold"
                style={{ color: "inherit" }}
              >
                {currentStatusView.label}
              </h2>
              <p className="mt-1 text-sm leading-6">
                {currentAssessment.reason}
              </p>
              <p className="mt-2 text-xs font-semibold opacity-75">
                判定元：
                {currentAssessment.source === "vercel"
                  ? "現在のVercel状態"
                  : "保存済みFirestore値"}
              </p>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border bg-white/85 p-5 shadow-sm">
        <h2 className="text-lg font-semibold" style={{ color: "#111827" }}>
          設定を編集
        </h2>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          プロトコルやパスを含めず、wwwを除いたドメイン名だけを入力してください。
        </p>

        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-gray-800">
              独自ドメイン
            </span>
            <input
              type="text"
              value={domain}
              onChange={(event) => {
                setDomain(event.target.value);
                setConfirming(false);
                setSaveResult(null);
              }}
              disabled={saving}
              placeholder="example.com"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="mt-2 min-h-11 w-full rounded-lg border bg-white px-3 text-base text-gray-900 disabled:bg-gray-100"
            />
          </label>

          <label className="flex min-h-11 items-center gap-3 rounded-lg border bg-white px-3">
            <input
              type="checkbox"
              checked={wwwEnabled}
              onChange={(event) => {
                setWwwEnabled(event.target.checked);
                setConfirming(false);
                setSaveResult(null);
              }}
              disabled={saving}
              className="h-5 w-5"
            />
            <span className="text-sm font-medium text-gray-900">
              www.example.com も利用する
            </span>
          </label>

          {!confirming ? (
            <button
              type="button"
              disabled={saveButton.disabled}
              onClick={() => {
                setConfirming(true);
                setSaveResult(null);
              }}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-blue-700 px-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {saveButton.label}
            </button>
          ) : (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
              <p className="font-semibold text-amber-950">
                この内容で保存しますか？
              </p>
              <dl className="mt-3 grid gap-2 text-sm text-amber-950">
                <div>
                  <dt className="font-semibold">ドメイン</dt>
                  <dd className="break-all">{domain || "未入力"}</dd>
                </div>
                <div>
                  <dt className="font-semibold">www利用</dt>
                  <dd>{wwwEnabled ? "利用する" : "利用しない"}</dd>
                </div>
              </dl>
              <p className="mt-3 text-sm leading-6 text-amber-900">
                保存後はDNS確認中になります。Vercelへの登録や旧ドメイン台帳の削除は行いません。
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-700 px-4 font-semibold text-white disabled:opacity-50"
                >
                  {saving ? "保存中…" : "確認して保存"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  disabled={saving}
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border bg-white px-4 font-semibold text-gray-800 disabled:opacity-50"
                >
                  キャンセル
                </button>
              </div>
            </div>
          )}

          {saveResult && (
            <div
              role="status"
              aria-live="polite"
              className={`rounded-lg border p-3 text-sm leading-6 ${
                saveResult.status === 200
                  ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                  : "border-red-300 bg-red-50 text-red-900"
              }`}
            >
              {saveResult.message}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border bg-white/85 p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold" style={{ color: "#111827" }}>
              Vercel接続状態
            </h2>
            <p className="mt-1 text-sm leading-6 text-gray-600">
              Vercelの現在状態を読み取り専用で確認します。登録や修正は行いません。
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:items-end">
            <button
              type="button"
              onClick={checkVercelStatus}
              disabled={
                vercelButton.disabled ||
                syncState.kind === "syncing" ||
                !data.domain
              }
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border bg-white px-4 font-semibold text-gray-900 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${
                  vercelState.kind === "checking" ? "animate-spin" : ""
                }`}
              />
              {vercelButton.label}
            </button>
            <button
              type="button"
              onClick={() => setSyncState({ kind: "confirming" })}
              disabled={syncButton.disabled || !data.domain}
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-700 px-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {syncButton.label}
            </button>
          </div>
        </div>

        {syncState.kind === "confirming" && (
          <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
            <p className="font-semibold">現在の接続状態を同期しますか？</p>
            <p className="mt-2 text-sm leading-6">
              VercelをGETで再確認し、Firestoreの接続状態・確認時刻・判定理由だけを更新します。ドメイン設定やVercel設定は変更しません。
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={syncDomainStatus}
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-700 px-4 font-semibold text-white"
              >
                確認して同期
              </button>
              <button
                type="button"
                onClick={() => setSyncState({ kind: "idle" })}
                className="inline-flex min-h-11 items-center justify-center rounded-lg border bg-white px-4 font-semibold text-gray-800"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}

        {syncState.kind === "syncing" && (
          <p className="mt-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
            Vercelを再確認し、接続状態を同期中です…
          </p>
        )}

        {(syncState.kind === "success" || syncState.kind === "error") && (
          <p
            className={`mt-4 rounded-lg border p-3 text-sm leading-6 ${
              syncState.kind === "success"
                ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                : "border-red-300 bg-red-50 text-red-900"
            }`}
            role={syncState.kind === "error" ? "alert" : "status"}
            aria-live="polite"
          >
            {syncState.message}
          </p>
        )}

        {vercelState.kind === "checking" && (
          <p className="mt-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
            Vercelの状態を確認中です…
          </p>
        )}

        {vercelState.kind === "error" && (
          <p
            className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm leading-6 text-red-900"
            role="alert"
          >
            {vercelState.message}
          </p>
        )}

        {vercelState.kind === "success" && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {Object.values(vercelState.data.hosts).map((host) => (
              <VercelHostCard key={host.kind} host={host} />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border bg-white/85 p-5 shadow-sm">
        <h2 className="text-lg font-semibold" style={{ color: "#111827" }}>
          ドメイン情報
        </h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <InfoItem label="独自ドメイン" value={data.domain ?? "未設定"} />
          <InfoItem
            label="正規ドメイン"
            value={data.canonicalHost ?? "未設定"}
          />
          <InfoItem
            label="www利用"
            value={data.wwwEnabled === true ? "利用する" : "利用しない"}
          />
          <div>
            <dt className="text-sm font-medium text-gray-500">登録ホスト</dt>
            {data.domains.length > 0 ? (
              <dd className="mt-1 space-y-1">
                {data.domains.map(({ hostname }) => (
                  <div key={hostname} className="flex items-center gap-2">
                    <span className="text-sm break-all">{hostname}</span>
                    <button
                      onClick={() => deleteHost(hostname)}
                      disabled={deletingHostname === hostname}
                      className="shrink-0 rounded px-2 py-0.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-40"
                    >
                      {deletingHostname === hostname ? "削除中…" : "削除"}
                    </button>
                  </div>
                ))}
              </dd>
            ) : (
              <dd className="mt-1 text-sm">未設定</dd>
            )}
          </div>
        </dl>
      </section>

      {data.domain !== null && (
        <section className="rounded-2xl border bg-white/85 p-5 shadow-sm">
          <h2 className="text-lg font-semibold" style={{ color: "#111827" }}>
            DNS設定
          </h2>
          <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm leading-6 text-amber-900">
            {vercelDnsRecords.length > 0
              ? "Vercel APIが返した現在の推奨値です。既存表示と異なる場合はこちらを優先してください。"
              : displayedDnsRecords.length === 0
              ? "「Vercel接続状態を確認」ボタンを押すと、このドメイン専用のDNS設定値が確認できます。"
              : data.dns?.notice ?? "DNS設定値"}
          </p>
          <div className="mt-4 space-y-3">
            {vercelState.kind === "success" &&
              displayedDnsRecords.length === 0 && (
                <p className="rounded-lg border bg-gray-50 p-4 text-sm text-gray-700">
                  推奨値を取得できません
                </p>
              )}
            {displayedDnsRecords.map((record) => {
              const key = `${record.type}:${record.name}`;
              return (
                <div
                  key={key}
                  className="grid gap-2 rounded-xl border p-4 sm:grid-cols-[80px_80px_1fr_auto] sm:items-center"
                >
                  <span className="text-xs font-semibold text-gray-500">
                    種類
                  </span>
                  <strong>{record.type}</strong>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500">ホスト名</p>
                    <code className="break-all text-sm">{record.name}</code>
                    <p className="mt-2 text-xs text-gray-500">値</p>
                    <code className="break-all text-sm">{record.value}</code>
                  </div>
                  <button
                    type="button"
                    onClick={() => onCopy(key, record.value)}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium hover:bg-gray-50"
                  >
                    <Copy className="h-4 w-4" />
                    {copied === key ? "コピー済み" : "値をコピー"}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function VercelHostCard({ host }: { host: VercelHostStatus }) {
  const view = VERCEL_HOST_STATUS_VIEW[host.status];
  const sslLabel = {
    ready: "証明書発行可能",
    checking: "SSL確認中",
    dns_pending: "DNS設定待ち",
    verification_pending: "ドメイン検証待ち",
  }[host.ssl.status];

  return (
    <article className={`rounded-xl border p-4 ${view.tone}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase">
            {host.kind === "apex" ? "APEX" : "WWW"}
          </p>
          <h3
            className="mt-1 break-all font-bold"
            style={{ color: "inherit" }}
          >
            {host.hostname}
          </h3>
        </div>
        <span className="shrink-0 rounded-full border bg-white/70 px-2 py-1 text-xs font-semibold">
          {view.label}
        </span>
      </div>

      <dl className="mt-4 grid gap-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt>検証</dt>
          <dd className="font-semibold">
            {host.verified ? "検証済み" : "未検証"}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>DNS</dt>
          <dd className="font-semibold">
            {host.dns.configuredBy ?? "未接続"}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>SSL</dt>
          <dd className="text-right font-semibold">{sslLabel}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>リダイレクト</dt>
          <dd className="break-all text-right font-semibold">
            {host.redirect.target
              ? `${host.redirect.target}${
                  host.redirect.statusCode
                    ? ` (${host.redirect.statusCode})`
                    : ""
                }`
              : "なし"}
          </dd>
        </div>
      </dl>

      {host.verification.length > 0 && (
        <div className="mt-4 rounded-lg border bg-white/70 p-3 text-xs">
          <p className="font-semibold">検証情報</p>
          {host.verification.map((item) => (
            <div
              key={`${item.type}:${item.domain}:${item.value}`}
              className="mt-2"
            >
              <p>{item.type}</p>
              <code className="block break-all">{item.domain}</code>
              <code className="block break-all">{item.value}</code>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-gray-50 p-4">
      <dt className="text-xs font-semibold text-gray-500">{label}</dt>
      <dd className="mt-1 whitespace-pre-line break-all font-medium">{value}</dd>
    </div>
  );
}
