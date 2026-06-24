import type { CUSTOMER } from "@/config/customer";

type DeepWiden<T> =
  T extends string ? string
  : T extends number ? number
  : T extends boolean ? boolean
  : T extends readonly (infer Item)[] ? DeepWiden<Item>[]
  : T extends object ? { -readonly [Key in keyof T]: DeepWiden<T[Key]> }
  : T;

/**
 * `customer.ts` の構造を正として、リテラル値だけを一般的な型へ広げた設定型。
 * 新しい設定項目は `CUSTOMER` に追加すれば、この型にも自動で反映されます。
 */
export type CustomerConfig = Omit<
  DeepWiden<typeof CUSTOMER>,
  "localizedContentMode"
> & {
  localizedContentMode: typeof CUSTOMER.localizedContentMode;
};

/**
 * Firestore の `sites/{siteKey}` から上書きできる設定。
 * オブジェクトは部分更新でき、配列は配列全体を置き換えます。
 */
export type CustomerConfigOverride = {
  [Key in keyof CustomerConfig]?: CustomerConfig[Key] extends readonly unknown[]
    ? CustomerConfig[Key]
    : CustomerConfig[Key] extends object
      ? CustomerConfigOverrideValue<CustomerConfig[Key]>
      : CustomerConfig[Key];
};

type CustomerConfigOverrideValue<T> = {
  [Key in keyof T]?: T[Key] extends readonly unknown[]
    ? T[Key]
    : T[Key] extends object
      ? CustomerConfigOverrideValue<T[Key]>
      : T[Key];
};

/**
 * 将来の `sites/{siteKey}` ドキュメント用の最小形。
 * `config` 配下に設定を置く形式と、設定を直下に置く形式の両方を読み取れます。
 */
export type CustomerSiteDocument = CustomerConfigOverride & {
  config?: CustomerConfigOverride;
};
