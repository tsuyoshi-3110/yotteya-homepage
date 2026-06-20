// src/components/productsEC/currency.ts
import type { UILang } from "@/lib/atoms/uiLangAtom";
import type { ProdDoc } from "./types";
import { TAX_RATE } from "./priceUtils";

/* ======================== 通貨表示まわり ======================== */

/** UI言語→ロケール */
const UILANG_TO_LOCALE: Partial<Record<UILang, string>> = {
  ja: "ja-JP",
  en: "en-US",
  zh: "zh-CN",
  "zh-TW": "zh-TW",
  ko: "ko-KR",
  fr: "fr-FR",
  es: "es-ES",
  de: "de-DE",
  pt: "pt-PT",
  it: "it-IT",
  ru: "ru-RU",
  th: "th-TH",
  vi: "vi-VN",
  id: "id-ID",
  hi: "hi-IN",
  ar: "ar-AE",
};

/** UI言語→通貨コード（APIが返す通貨のみ） */
const UILANG_TO_CCY: Partial<Record<UILang, string>> = {
  ja: "JPY",
  en: "USD",
  zh: "CNY",
  "zh-TW": "TWD",
  ko: "KRW",
  fr: "EUR",
  es: "EUR",
  de: "EUR",
  pt: "EUR",
  it: "EUR",
  ru: "EUR", // RUB 未取得のため安全側で EUR
  th: "USD", // THB 未取得のため安全側で USD
  vi: "USD", // VND 未取得のため安全側で USD
  id: "USD", // IDR 未取得のため安全側で USD
  hi: "USD", // INR 未取得のため安全側で USD
  ar: "USD", // AED/SAR 未取得のため安全側で USD
};

/** 小数無し通貨（表示時も 0 桁） */
const ZERO_DECIMAL = new Set(["JPY", "KRW", "VND", "TWD"]);

/** JPY 税込→言語に応じた通貨文字列に整形（フェールセーフは JPY） */
export function formatPriceByLang(
  jpyIncl: number,
  lang: UILang,
  rates: Record<string, number> | null
) {
  const locale = UILANG_TO_LOCALE[lang] ?? "en-US";
  const ccy = UILANG_TO_CCY[lang] ?? "JPY";

  // レート未取得 or 未対応通貨 → JPY のまま表示
  const rate = rates?.[ccy];
  if (!rate) {
    return new Intl.NumberFormat(UILANG_TO_LOCALE.ja ?? "ja-JP", {
      style: "currency",
      currency: "JPY",
      maximumFractionDigits: 0,
    }).format(jpyIncl);
  }

  const major = jpyIncl * rate;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: ccy,
    maximumFractionDigits: ZERO_DECIMAL.has(ccy) ? 0 : 2,
  }).format(major);
}

/** ドキュメントから「税込価格」を安全に取得 */
// 元コード: return p.taxIncluded === false ? Math.round(raw * (1 + TAX_RATE)) : raw;
export function ensurePriceInclFromDoc(p: ProdDoc): number {
  const raw = Number(p.price ?? 0);
  return p.taxIncluded === false ? Math.round(raw * (1 + TAX_RATE)) : raw;
}
