import test from "node:test";
import assert from "node:assert/strict";
import {
  domainSaveMessage,
  getDomainSaveButtonState,
} from "./domain-settings-form.ts";

test("save button state prevents double submission", () => {
  assert.deepEqual(
    getDomainSaveButtonState({ saving: true, dirty: true }),
    { disabled: true, label: "保存中…" },
  );
  assert.deepEqual(
    getDomainSaveButtonState({ saving: false, dirty: false }),
    { disabled: true, label: "変更を保存" },
  );
  assert.deepEqual(
    getDomainSaveButtonState({ saving: false, dirty: true }),
    { disabled: false, label: "変更を保存" },
  );
});

test("success and every required API error have distinct UI messages", () => {
  assert.match(domainSaveMessage(200, true), /保存しました/);
  assert.match(domainSaveMessage(200, false), /変更はありません/);
  assert.match(domainSaveMessage(400), /入力/);
  assert.match(domainSaveMessage(401), /ログイン/);
  assert.match(domainSaveMessage(403), /権限/);
  assert.match(domainSaveMessage(409), /別のサイト/);
  assert.match(domainSaveMessage(500), /保存できません/);
});

test("existing read error messages remain separate from save messages", () => {
  assert.notEqual(domainSaveMessage(400), domainSaveMessage(409));
  assert.notEqual(domainSaveMessage(401), domainSaveMessage(403));
});
