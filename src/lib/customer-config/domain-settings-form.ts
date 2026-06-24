export function getDomainSaveButtonState({
  saving,
  dirty,
}: {
  saving: boolean;
  dirty: boolean;
}) {
  return {
    disabled: saving || !dirty,
    label: saving ? "保存中…" : "変更を保存",
  };
}

export function domainSaveMessage(status: number, changed?: boolean): string {
  if (status === 200) {
    if (changed === false) {
      return "保存済みの設定と同じため、変更はありません。";
    }
    return "独自ドメイン設定を保存しました。DNS確認中として反映されます。";
  }
  if (status === 400) {
    return "入力内容を確認してください。ドメインはwwwを除くhostnameのみ入力できます。";
  }
  if (status === 401) {
    return "ログインが必要です。管理者ログイン後に再度お試しください。";
  }
  if (status === 403) {
    return "このサイトの独自ドメイン設定を変更する権限がありません。";
  }
  if (status === 409) {
    return "このドメインは別のサイトに割り当て済みです。";
  }
  return "独自ドメイン設定を保存できませんでした。変更は反映されていません。";
}
