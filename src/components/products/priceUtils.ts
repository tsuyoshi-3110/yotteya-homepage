// components/products/priceUtils.ts
import type { UILang } from "@/lib/atoms/uiLangAtom";

/* ===== 税率・丸め ===== */
export const TAX_RATE = 0.1 as const;
export type RoundingPolicy = "round" | "floor" | "ceil";
export const ROUNDING_POLICY: RoundingPolicy = "round";

export const rint = (n: number, policy: RoundingPolicy = ROUNDING_POLICY) =>
  policy === "floor"
    ? Math.floor(n)
    : policy === "ceil"
    ? Math.ceil(n)
    : Math.round(n);

export const toExclYen = (
  incl: number,
  taxRate = TAX_RATE,
  policy: RoundingPolicy = ROUNDING_POLICY
) => rint((Number(incl) || 0) / (1 + taxRate), policy);

// ★ 税抜 → 税込
export const toInclYen = (
  excl: number,
  taxRate = TAX_RATE,
  policy: RoundingPolicy = ROUNDING_POLICY
) => rint((Number(excl) || 0) * (1 + taxRate), policy);

/* ===== 税表示テキスト ===== */
export const TAX_T: Record<UILang, { incl: string; excl: string }> = {
  ja: { incl: "税込", excl: "税抜" },
  en: { incl: "tax included", excl: "tax excluded" },
  zh: { incl: "含税", excl: "不含税" },
  "zh-TW": { incl: "含稅", excl: "未稅" },
  ko: { incl: "부가세 포함", excl: "부가세 별도" },
  fr: { incl: "TTC", excl: "HT" },
  es: { incl: "IVA incluido", excl: "sin IVA" },
  de: { incl: "inkl. MwSt.", excl: "zzgl. MwSt." },
  pt: { incl: "com impostos", excl: "sem impostos" },
  it: { incl: "IVA inclusa", excl: "IVA esclusa" },
  ru: { incl: "с НДС", excl: "без НДС" },
  th: { incl: "รวมภาษี", excl: "ไม่รวมภาษี" },
  vi: { incl: "đã gồm thuế", excl: "chưa gồm thuế" },
  id: { incl: "termasuk pajak", excl: "tidak termasuk pajak" },
  hi: { incl: "कर सहित", excl: "कर के बिना" },
  ar: { incl: "شامل الضريبة", excl: "غير شامل الضريبة" },
};

/* ===== 言語→通貨/ロケール と表示関数 ===== */
const CURRENCY_BY_LANG: Record<UILang, { currency: string; locale: string }> = {
  ja: { currency: "JPY", locale: "ja-JP" },
  en: { currency: "USD", locale: "en-US" },
  zh: { currency: "CNY", locale: "zh-CN" },
  "zh-TW": { currency: "TWD", locale: "zh-TW" },
  ko: { currency: "KRW", locale: "ko-KR" },
  fr: { currency: "EUR", locale: "fr-FR" },
  es: { currency: "EUR", locale: "es-ES" },
  de: { currency: "EUR", locale: "de-DE" },
  pt: { currency: "BRL", locale: "pt-BR" },
  it: { currency: "EUR", locale: "it-IT" },
  ru: { currency: "RUB", locale: "ru-RU" },
  th: { currency: "THB", locale: "th-TH" },
  vi: { currency: "VND", locale: "vi-VN" },
  id: { currency: "IDR", locale: "id-ID" },
  hi: { currency: "INR", locale: "hi-IN" },
  ar: { currency: "AED", locale: "ar-AE" },
};

export function formatPriceFromJPY(
  amountJPY: number,
  uiLang: UILang,
  rates: Record<string, number> | null
) {
  const { currency, locale } = CURRENCY_BY_LANG[uiLang] ?? {
    currency: "JPY",
    locale: "ja-JP",
  };

  // レートが無い or 通貨がJPYのときはそのままJPY表示
  if (!rates || currency === "JPY" || rates[currency] == null) {
    return {
      text: new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "JPY",
      }).format(amountJPY),
      approx: false,
    };
  }

  const converted = amountJPY * rates[currency];
  return {
    text: new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
    }).format(converted),
    approx: true,
  };
}
