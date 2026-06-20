"use client";

import React, { useMemo } from "react";
import clsx from "clsx";
import {
  SwipeableList,
  SwipeableListItem,
  LeadingActions,
  TrailingActions,
  SwipeAction,
} from "react-swipeable-list";
import "react-swipeable-list/dist/styles.css";


import { ThemeKey, THEMES } from "@/lib/themes";
import { useThemeGradient } from "@/lib/useThemeGradient";

// 多言語
import { useUILang } from "@/lib/atoms/uiLangAtom";
// 為替レート
import { useFxRates } from "@/lib/fx/client";

type MenuItem = {
  id: string;
  name: string;
  description?: string;
  price?: number | null; // 円（税込）
  isTaxIncluded?: boolean;
  order: number;
};

// 税ラベル＆注意書き
type PriceMsgs = {
  taxIncluded: string;
  taxExcluded: string;
  jpyNote: string;
};

// UI 言語 → 文言
const PRICE_MSGS: Record<string, PriceMsgs> = {
  ja: {
    taxIncluded: "税込",
    taxExcluded: "税別",
    // 日本語 UI では注意書きは表示しないので空でOK
    jpyNote: "",
  },
  en: {
    taxIncluded: "tax included",
    taxExcluded: "tax excluded",
    jpyNote:
      "※ Displayed amounts are approximate conversions based on current FX rates. Due to currency fluctuations, the displayed prices may vary slightly. Payments are processed in Japanese Yen (JPY).",
  },
  zh: {
    taxIncluded: "含税",
    taxExcluded: "不含税",
    jpyNote:
      "※ 金额为按当前汇率换算的参考价格，汇率波动可能导致显示金额略有变动。实际结算货币为日元（JPY）。",
  },
  "zh-TW": {
    taxIncluded: "含稅",
    taxExcluded: "未稅",
    jpyNote:
      "※ 顯示金額為依當前匯率換算之參考價格，匯率波動可能造成顯示金額略有變動。實際結帳貨幣為日圓（JPY）。",
  },
  ko: {
    taxIncluded: "세금 포함",
    taxExcluded: "세금 별도",
    jpyNote:
      "※ 표시 금액은 현재 환율을 기준으로 한 참고 금액이며, 환율 변동에 따라 금액이 다소 달라질 수 있습니다. 실제 결제는 일본 엔화(JPY)로 진행됩니다.",
  },
  fr: {
    taxIncluded: "TTC",
    taxExcluded: "HT",
    jpyNote:
      "※ Les montants affichés sont des conversions approximatives basées sur le taux de change actuel. En raison des fluctuations de change, le prix affiché peut légèrement varier. Le paiement est effectué en yen japonais (JPY).",
  },
  es: {
    taxIncluded: "impuestos incluidos",
    taxExcluded: "sin impuestos",
    jpyNote:
      "※ Los precios mostrados son conversiones aproximadas basadas en el tipo de cambio actual. Debido a las fluctuaciones de la moneda, los importes pueden variar ligeramente. El pago se realiza en yenes japoneses (JPY).",
  },
  de: {
    taxIncluded: "inkl. Steuern",
    taxExcluded: "zzgl. Steuern",
    jpyNote:
      "※ Die angezeigten Beträge sind ungefähre Umrechnungen auf Basis des aktuellen Wechselkurses. Aufgrund von Wechselkursschwankungen können sich die Preise leicht ändern. Abgerechnet wird in japanischen Yen (JPY).",
  },
  pt: {
    taxIncluded: "com impostos",
    taxExcluded: "sem impostos",
    jpyNote:
      "※ Os valores exibidos são conversões aproximadas com base na taxa de câmbio atual. Devido à flutuação cambial, os preços podem variar ligeiramente. O pagamento é processado em ienes japoneses (JPY).",
  },
  it: {
    taxIncluded: "IVA inclusa",
    taxExcluded: "IVA esclusa",
    jpyNote:
      "※ Gli importi mostrati sono conversioni approssimative basate sul tasso di cambio attuale. A causa delle fluttuazioni dei cambi, i prezzi possono variare leggermente. Il pagamento avviene in yen giapponesi (JPY).",
  },
  ru: {
    taxIncluded: "с налогом",
    taxExcluded: "без налога",
    jpyNote:
      "※ Указанные суммы являются ориентировочными и рассчитываются по текущему курсу. Из-за колебаний курса стоимость может немного меняться. Оплата производится в японских иенах (JPY).",
  },
  th: {
    taxIncluded: "รวมภาษี",
    taxExcluded: "ไม่รวมภาษี",
    jpyNote:
      "※ ราคาที่แสดงเป็นการคำนวณโดยประมาณตามอัตราแลกเปลี่ยนปัจจุบัน อาจมีการเปลี่ยนแปลงเล็กน้อยตามความผันผวนของค่าเงิน การชำระเงินจริงเป็นเงินเยนญี่ปุ่น (JPY)",
  },
  vi: {
    taxIncluded: "đã gồm thuế",
    taxExcluded: "chưa gồm thuế",
    jpyNote:
      "※ Giá hiển thị là quy đổi tham khảo theo tỷ giá hiện tại, có thể thay đổi nhẹ do biến động tỷ giá. Thanh toán thực tế bằng yên Nhật (JPY).",
  },
  id: {
    taxIncluded: "sudah termasuk pajak",
    taxExcluded: "belum termasuk pajak",
    jpyNote:
      "※ Harga yang ditampilkan adalah konversi perkiraan berdasarkan kurs saat ini dan dapat sedikit berubah karena fluktuasi nilai tukar. Pembayaran dilakukan dalam Yen Jepang (JPY).",
  },
  hi: {
    taxIncluded: "कर सहित",
    taxExcluded: "कर अलग से",
    jpyNote:
      "※ दिखाए गए दाम वर्तमान विनिमय दर पर आधारित अनुमानित हैं और दरों में उतार-चढ़ाव के कारण थोड़ा बदल सकते हैं। वास्तविक भुगतान जापानी येन (JPY) में किया जाएगा।",
  },
  ar: {
    taxIncluded: "شامل الضريبة",
    taxExcluded: "غير شامل الضريبة",
    jpyNote:
      "※ الأسعار المعروضة عبارة عن تحويلات تقريبية تعتمد على سعر الصرف الحالي، وقد تتغيّر قليلاً بسبب تقلبات العملات. تتم عملية الدفع فعلياً بالين الياباني (JPY).",
  },
};

// UI 言語 → 表示通貨（必要に応じて調整可）
const CCY_BY_LANG: Record<string, string> = {
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
  ru: "RUB",
  th: "THB",
  vi: "VND",
  id: "IDR",
  hi: "INR",
  ar: "USD",
};

// 小数を使わない通貨
const ZERO_DECIMAL_CCY = new Set(["JPY", "KRW", "VND"]);

/**
 * JPY（内部価格）を UI 言語に応じた通貨文字列へ変換
 * - rates: 1 JPY -> X {ccy}
 */
function formatPriceByLangSimple(
  yen: number,
  lang: string,
  rates: Record<string, number> | null
): { text: string; ccy: string } {
  const ccy = CCY_BY_LANG[lang] ?? "JPY";

  // 為替が取れない or JPY の場合はそのまま日本円表示
  if (!rates || !rates[ccy] || ccy === "JPY") {
    const formatter = new Intl.NumberFormat("ja-JP", {
      style: "currency",
      currency: "JPY",
      maximumFractionDigits: 0,
    });
    return { text: formatter.format(yen), ccy: "JPY" };
  }

  const rate = rates[ccy];
  const major = yen * rate;
  const zeroDecimal = ZERO_DECIMAL_CCY.has(ccy);

  const formatter = new Intl.NumberFormat(lang === "ja" ? "ja-JP" : undefined, {
    style: "currency",
    currency: ccy,
    maximumFractionDigits: zeroDecimal ? 0 : 2,
    minimumFractionDigits: zeroDecimal ? 0 : 2,
  });

  return { text: formatter.format(major), ccy };
}

export default function MenuItemCard({
  item,
  onDelete,
  onEdit,
  isLoggedIn,
}: {
  item: MenuItem;
  onDelete: () => void;
  onEdit: (item: MenuItem) => void;
  isLoggedIn: boolean;
}) {
  const gradient = useThemeGradient();
  const isDark = useMemo(() => {
    const dark: ThemeKey[] = ["brandG", "brandH", "brandI"];
    return gradient ? dark.some((k) => gradient === THEMES[k]) : false;
  }, [gradient]);

  // UI 言語 & 為替
  const { uiLang } = useUILang();
  const { rates } = useFxRates();
  const priceMsgs = PRICE_MSGS[uiLang] ?? PRICE_MSGS.ja;

  const priceDisplay = useMemo(() => {
    if (item.price == null) return null;
    return formatPriceByLangSimple(item.price, uiLang, rates);
  }, [item.price, uiLang, rates]);

  const leading = () =>
    isLoggedIn ? (
      <LeadingActions>
        <SwipeAction onClick={() => onEdit(item)}>
          <div className="bg-emerald-500 text-white px-4 py-2 flex items-center justify-center whitespace-nowrap w-24 rounded-l">
            編集
          </div>
        </SwipeAction>
      </LeadingActions>
    ) : undefined;

  const trailing = () =>
    isLoggedIn ? (
      <TrailingActions>
        <SwipeAction onClick={onDelete}>
          <div className="bg-red-500 text-white px-4 py-2 flex items-center justify-center whitespace-nowrap w-24 rounded-r">
            削除
          </div>
        </SwipeAction>
      </TrailingActions>
    ) : undefined;

  return (
   <div>
      <SwipeableList threshold={0.25}>
        <SwipeableListItem
          leadingActions={leading()}
          trailingActions={trailing()}
        >
          <div
            className={clsx(
              "flex flex-col gap-1 py-3 px-2 rounded border-b",
              isDark
                ? "text-white border-white/20"
                : "text-black border-gray-200"
            )}
          >
            {/* メニュー名 */}
            <p
              className={clsx(
                "font-semibold whitespace-pre-wrap text-black"
              )}
            >
              {item.name}
            </p>

            {/* 価格（為替通貨で表示） */}
            {item.price != null && priceDisplay && (
              <div className={clsx("text-sm", "text-black")}>
                <span>
                  {priceDisplay.text}
                  {typeof item.isTaxIncluded === "boolean"
                    ? `（${
                        item.isTaxIncluded
                          ? priceMsgs.taxIncluded
                          : priceMsgs.taxExcluded
                      }）`
                    : ""}
                </span>

                {/* 日本語 UI 以外のときだけ注意書きを表示 */}
                {uiLang !== "ja" && priceMsgs.jpyNote && (
                  <p className="mt-0.5 text-[10px] leading-snug opacity-80">
                    {priceMsgs.jpyNote}
                  </p>
                )}
              </div>
            )}

            {/* 説明文 */}
            {item.description && (
              <p
                className={clsx(
                  "whitespace-pre-wrap text-sm",
                  "text-black"
                )}
              >
                {item.description}
              </p>
            )}
          </div>
        </SwipeableListItem>
      </SwipeableList>
</div>
  );
}
