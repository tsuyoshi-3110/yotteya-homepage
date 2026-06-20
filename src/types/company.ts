

import { LANGS } from "@/lib/langs";
export type LangKey = (typeof LANGS)[number]["key"];

/* ========= Types ========= */
export type MediaKind = "image" | "video" | null;

export type TranslatableFields = {
  name: string;
  tagline?: string | null;
  about?: string | null;
  business?: string[]; // 1項目1行
  address?: string | null;
};

export type TranslatedPack = {
  lang: LangKey;
  name?: string;
  tagline?: string | null;
  about?: string | null;
  business?: string[];
  address?: string | null;
};

export type CompanyDoc = {
  // 多言語
  base?: TranslatableFields;
  t?: TranslatedPack[];

  // 非翻訳（共通）
  founded?: string | null; // 設立
  ceo?: string | null; // 代表者名
  capital?: string | null; // 資本金
  employees?: string | null; // 従業員数
  phone?: string | null;
  email?: string | null;
  website?: string | null;

  // タイトル直下のメディア
  heroMediaUrl?: string | null;
  heroMediaType?: MediaKind;

  // 住所からマップを表示するかどうか
  useAddressForMap?: boolean;

  // メタ
  updatedAt?: any;
  updatedByUid?: string | null;
  updatedByName?: string | null;

  // 後方互換（従来の平坦フィールド）
  name?: string;
  tagline?: string | null;
  about?: string | null;
  business?: string[];
  address?: string | null;
};

export type CompanyProfileView = {
  // 表示用（ローカライズ済み）
  name: string;
  tagline?: string | null;
  about?: string | null;
  business?: string[];
  address?: string | null;

  // 共通
  founded?: string | null;
  ceo?: string | null;
  capital?: string | null;
  employees?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  heroMediaUrl?: string | null;
  heroMediaType?: MediaKind;
  useAddressForMap?: boolean;
};

export type AiTarget = "about" | "business";

export type AiContext = {
  companyName?: string;
  tagline?: string | null;
  location?: string | null;
  audience?: string | null;
  industryHint?: string | null;
  existingAbout?: string | null;
  existingBusiness?: string[];
};
