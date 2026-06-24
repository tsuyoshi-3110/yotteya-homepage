import test from "node:test";
import assert from "node:assert/strict";
import {
  domainStatusSyncMessage,
  getDomainStatusSyncButtonState,
} from "./domain-status-sync-view.ts";

test("sync button prevents concurrent status checks and duplicate submissions", () => {
  assert.deepEqual(
    getDomainStatusSyncButtonState({ syncing: true, checking: false }),
    { disabled: true, label: "同期中…" },
  );
  assert.deepEqual(
    getDomainStatusSyncButtonState({ syncing: false, checking: true }),
    { disabled: true, label: "接続状態を同期" },
  );
  assert.deepEqual(
    getDomainStatusSyncButtonState({ syncing: false, checking: false }),
    { disabled: false, label: "接続状態を同期" },
  );
});

test("success and required errors have explicit messages", () => {
  assert.match(domainStatusSyncMessage(200, true), /同期しました/);
  assert.match(domainStatusSyncMessage(200, false), /状態確認時刻/);
  assert.match(domainStatusSyncMessage(401), /ログイン/);
  assert.match(domainStatusSyncMessage(403), /権限/);
  assert.match(domainStatusSyncMessage(409), /変更されたため中止/);
  assert.match(domainStatusSyncMessage(429), /回数制限/);
  assert.match(domainStatusSyncMessage(503), /Firestoreは変更していません/);
  assert.match(domainStatusSyncMessage(500), /同期できません/);
});
