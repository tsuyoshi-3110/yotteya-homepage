export function getDomainStatusSyncButtonState({
  syncing,
  checking,
}: {
  syncing: boolean;
  checking: boolean;
}) {
  return {
    disabled: syncing || checking,
    label: syncing ? "同期中…" : "接続状態を同期",
  };
}

export function domainStatusSyncMessage(
  status: number,
  changed?: boolean,
): string {
  if (status === 200) {
    return changed === false
      ? "接続状態は同じです。状態確認時刻を更新しました。"
      : "Vercelの現在判定を保存済み状態へ同期しました。";
  }
  if (status === 401) return "ログインが必要です。";
  if (status === 403) return "このサイトの接続状態を同期する権限がありません。";
  if (status === 409) {
    return "同期中にドメイン設定が変更されたため中止しました。再確認してください。";
  }
  if (status === 429) {
    return "Vercelの確認回数制限に達しました。時間をおいて再度お試しください。";
  }
  if (status === 503) {
    return "Vercelの状態を取得できなかったため、Firestoreは変更していません。";
  }
  return "接続状態を同期できませんでした。変更は反映されていません。";
}
