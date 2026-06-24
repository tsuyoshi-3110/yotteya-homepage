import test from "node:test";
import assert from "node:assert/strict";
import {
  assessCurrentDomainConnection,
  DOMAIN_STATUS_VIEW,
  domainSettingsErrorMessage,
  normalizeDomainConnectionStatus,
} from "./domain-settings-view.ts";

test("all required domain statuses have the expected Japanese labels", () => {
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(DOMAIN_STATUS_VIEW).map(([key, value]) => [
        key,
        value.label,
      ])
    ),
    {
      unconfigured: "未設定",
      pending_dns: "DNS確認中",
      pending_ssl: "SSL発行中",
      active: "接続完了",
      error: "設定エラー",
    }
  );
});

test("unknown status safely displays as unconfigured", () => {
  assert.equal(normalizeDomainConnectionStatus("unknown"), "unconfigured");
  assert.equal(normalizeDomainConnectionStatus(null), "unconfigured");
});

test("API error statuses have distinct user-facing messages", () => {
  assert.match(domainSettingsErrorMessage(401), /ログイン/);
  assert.match(domainSettingsErrorMessage(403), /権限/);
  assert.match(domainSettingsErrorMessage(404), /未設定/);
  assert.match(domainSettingsErrorMessage(500), /取得できません/);
});

function completeHost({
  hostname,
  kind,
  redirectTarget = null,
} = {}) {
  return {
    hostname,
    kind,
    status: "connection_complete",
    configured: true,
    verified: true,
    misconfigured: false,
    redirect: {
      target: redirectTarget,
      statusCode: redirectTarget ? 307 : null,
    },
    dns: { configuredBy: kind === "apex" ? "A" : "CNAME" },
    ssl: { status: "ready" },
  };
}

function vercelSuccess({
  apex = completeHost({
    hostname: "example.com",
    kind: "apex",
  }),
  www = completeHost({
    hostname: "www.example.com",
    kind: "www",
    redirectTarget: "example.com",
  }),
} = {}) {
  return {
    kind: "success",
    data: {
      hosts: { apex, www },
    },
  };
}

test("unconfigured is returned when no domain is saved", () => {
  assert.deepEqual(
    assessCurrentDomainConnection({
      domain: null,
      canonicalHost: null,
      wwwEnabled: false,
      firestoreStatus: "unconfigured",
      vercel: { kind: "not_requested" },
    }),
    {
      status: "unconfigured",
      source: "firestore",
      reason: "独自ドメインが設定されていません。",
    },
  );
});

test("Vercel complete apex and expected www produce active", () => {
  const result = assessCurrentDomainConnection({
    domain: "example.com",
    canonicalHost: "example.com",
    wwwEnabled: true,
    firestoreStatus: "pending_dns",
    vercel: vercelSuccess(),
  });

  assert.equal(result.status, "active");
  assert.equal(result.source, "vercel");
  assert.match(result.reason, /DNS・SSL・リダイレクト/);
});

test("DNS mismatch and verification waiting produce pending_dns", () => {
  for (const apex of [
    {
      ...completeHost({ hostname: "example.com", kind: "apex" }),
      misconfigured: true,
      configured: false,
      status: "dns_pending",
    },
    {
      ...completeHost({ hostname: "example.com", kind: "apex" }),
      verified: false,
      status: "verification_pending",
    },
  ]) {
    const result = assessCurrentDomainConnection({
      domain: "example.com",
      canonicalHost: "example.com",
      wwwEnabled: false,
      firestoreStatus: "active",
      vercel: vercelSuccess({ apex }),
    });
    assert.equal(result.status, "pending_dns");
    assert.match(result.reason, /DNS|検証/);
  }
});

test("verified DNS with unfinished SSL produces pending_ssl", () => {
  const apex = {
    ...completeHost({ hostname: "example.com", kind: "apex" }),
    status: "ssl_checking",
    ssl: { status: "checking" },
  };
  const result = assessCurrentDomainConnection({
    domain: "example.com",
    canonicalHost: "example.com",
    wwwEnabled: false,
    firestoreStatus: "active",
    vercel: vercelSuccess({ apex }),
  });

  assert.equal(result.status, "pending_ssl");
  assert.match(result.reason, /SSL/);
});

test("www is required only when wwwEnabled is true", () => {
  const brokenWww = {
    ...completeHost({
      hostname: "www.example.com",
      kind: "www",
      redirectTarget: "example.com",
    }),
    verified: false,
    configured: false,
    status: "verification_pending",
  };

  assert.equal(
    assessCurrentDomainConnection({
      domain: "example.com",
      canonicalHost: "example.com",
      wwwEnabled: false,
      firestoreStatus: "active",
      vercel: vercelSuccess({ www: brokenWww }),
    }).status,
    "active",
  );
  assert.equal(
    assessCurrentDomainConnection({
      domain: "example.com",
      canonicalHost: "example.com",
      wwwEnabled: true,
      firestoreStatus: "active",
      vercel: vercelSuccess({ www: brokenWww }),
    }).status,
    "pending_dns",
  );
});

test("redirect target different from canonicalHost produces error", () => {
  const www = completeHost({
    hostname: "www.example.com",
    kind: "www",
    redirectTarget: "other.example.com",
  });
  const result = assessCurrentDomainConnection({
    domain: "example.com",
    canonicalHost: "example.com",
    wwwEnabled: true,
    firestoreStatus: "active",
    vercel: vercelSuccess({ www }),
  });

  assert.equal(result.status, "error");
  assert.match(result.reason, /リダイレクト先/);
});

test("contradictory Vercel state produces error", () => {
  const apex = {
    ...completeHost({ hostname: "unexpected.example", kind: "apex" }),
  };
  const result = assessCurrentDomainConnection({
    domain: "example.com",
    canonicalHost: "example.com",
    wwwEnabled: false,
    firestoreStatus: "active",
    vercel: vercelSuccess({ apex }),
  });

  assert.equal(result.status, "error");
  assert.match(result.reason, /一致しません/);
});

test("Vercel failure produces error with a clear reason", () => {
  const result = assessCurrentDomainConnection({
    domain: "example.com",
    canonicalHost: "example.com",
    wwwEnabled: true,
    firestoreStatus: "active",
    vercel: { kind: "error" },
  });

  assert.equal(result.status, "error");
  assert.equal(result.source, "vercel");
  assert.match(result.reason, /取得できなかった/);
});

test("before Vercel lookup the Firestore status remains visible and distinguished", () => {
  const result = assessCurrentDomainConnection({
    domain: "example.com",
    canonicalHost: "example.com",
    wwwEnabled: true,
    firestoreStatus: "active",
    vercel: { kind: "not_requested" },
  });

  assert.deepEqual(result, {
    status: "active",
    source: "firestore",
    reason:
      "Vercelの現在状態は未確認です。保存済みの接続状態を表示しています。",
  });
});
