import test from "node:test";
import assert from "node:assert/strict";
import {
  formatVercelDnsRecords,
  getVercelCheckButtonState,
  vercelCheckErrorMessage,
  VERCEL_HOST_STATUS_VIEW,
} from "./vercel-domain-status-view.ts";

test("checking state prevents repeated execution", () => {
  assert.deepEqual(getVercelCheckButtonState(true), {
    disabled: true,
    label: "確認中…",
  });
  assert.deepEqual(getVercelCheckButtonState(false), {
    disabled: false,
    label: "Vercel接続状態を確認",
  });
});

test("success states have required Japanese labels", () => {
  assert.equal(VERCEL_HOST_STATUS_VIEW.connection_complete.label, "接続完了");
  assert.equal(VERCEL_HOST_STATUS_VIEW.dns_pending.label, "DNS設定待ち");
  assert.equal(
    VERCEL_HOST_STATUS_VIEW.verification_pending.label,
    "検証待ち",
  );
  assert.equal(VERCEL_HOST_STATUS_VIEW.ssl_checking.label, "SSL確認中");
});

test("failure message does not expose upstream details", () => {
  const message = vercelCheckErrorMessage(503);
  assert.match(message, /取得できません/);
  assert.equal(message.includes("token"), false);
});

test("display records keep apex A and www CNAME separated and deduplicated", () => {
  assert.deepEqual(
    formatVercelDnsRecords({
      apex: {
        dns: {
          recommended: [
            { type: "A", rank: 1, value: "216.198.79.1" },
            { type: "A", rank: 2, value: "216.198.79.1" },
          ],
        },
      },
      www: {
        dns: {
          recommended: [
            {
              type: "CNAME",
              rank: 1,
              value: "example.vercel-dns.com.",
            },
            {
              type: "CNAME",
              rank: 2,
              value: "example.vercel-dns.com.",
            },
          ],
        },
      },
    }),
    [
      { type: "A", name: "@", value: "216.198.79.1" },
      {
        type: "CNAME",
        name: "www",
        value: "example.vercel-dns.com.",
      },
    ],
  );
});

test("display records ignore wrong host types and invalid records", () => {
  assert.deepEqual(
    formatVercelDnsRecords({
      apex: {
        dns: {
          recommended: [
            { type: "CNAME", rank: 1, value: "wrong.example." },
            { type: "A", rank: 1, value: "" },
          ],
        },
      },
      www: {
        dns: {
          recommended: [
            { type: "A", rank: 1, value: "216.198.79.1" },
            { type: "CNAME", rank: 1, value: "" },
          ],
        },
      },
    }),
    [],
  );
});
