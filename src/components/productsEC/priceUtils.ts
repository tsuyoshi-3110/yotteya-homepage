// src/components/productsEC/priceUtils.ts
import type { UILang } from "@/lib/atoms/uiLangAtom";

// 税率(日本:10%)
export const TAX_RATE = 0.1 as const;

// 四捨五入
export const rint = (n: number) => Math.round(n);

// 税込 → 税抜（円）
export const toExclYen = (incl: number, rate = TAX_RATE) =>
  rint((Number(incl) || 0) / (1 + rate));

// 税抜 → 税込（円）
export const toInclYen = (excl: number, rate = TAX_RATE) =>
  rint((Number(excl) || 0) * (1 + rate));

// 税込/税抜 ラベル
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
