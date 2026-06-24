// app/(admin)/shipping/ShippingPriceSettingPage.tsx
"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSiteKey } from "@/lib/atoms/siteKeyAtom";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

/* =========================
   対応言語（提供いただいた定義）
   ========================= */
const LANG_DEFS = [
  { key: "ja", label: "日本語", emoji: "🇯🇵" },
  { key: "en", label: "English", emoji: "🇺🇸" },
  { key: "zh", label: "简体中文", emoji: "🇨🇳" },
  { key: "zh-TW", label: "繁體中文", emoji: "🇹🇼" },
  { key: "ko", label: "한국어", emoji: "🇰🇷" },
  { key: "fr", label: "Français", emoji: "🇫🇷" },
  { key: "es", label: "Español", emoji: "🇪🇸" },
  { key: "de", label: "Deutsch", emoji: "🇩🇪" },
  { key: "pt", label: "Português", emoji: "🇵🇹" },
  { key: "it", label: "Italiano", emoji: "🇮🇹" },
  { key: "ru", label: "Русский", emoji: "🇷🇺" },
  { key: "th", label: "ไทย", emoji: "🇹🇭" },
  { key: "vi", label: "Tiếng Việt", emoji: "🇻🇳" },
  { key: "id", label: "Bahasa Indonesia", emoji: "🇮🇩" },
  { key: "hi", label: "हिन्दी", emoji: "🇮🇳" },
  { key: "ar", label: "العربية", emoji: "🇸🇦" },
] as const;

type LangKey = typeof LANG_DEFS[number]["key"];
const LANG_KEYS: LangKey[] = LANG_DEFS.map((l) => l.key);

/* =========================
   型
   ========================= */
type NumDict = { [key in LangKey]?: number };
type NumOrEmptyDict = { [key in LangKey]?: number | "" };

interface ShippingRateHint {
  lang: LangKey;
  country: string;
  city: string;
  average_price_jpy?: number; // 未設定可
}

interface ShippingPolicyDoc {
  enabled?: boolean; // 送料無料ON/OFF
  thresholdByLang?: NumDict; // 言語別「◯円以上で送料無料」
}

/* =========================
   参考送料（フロント固定・編集可）
   ※未設定言語は average_price_jpy 省略 → UI は「未設定」表示
   ========================= */
const HINTS: Record<LangKey, ShippingRateHint> = {
  ja: { lang: "ja", country: "日本", city: "東京", average_price_jpy: 900 },
  en: { lang: "en", country: "アメリカ", city: "ニューヨーク", average_price_jpy: 4000 },
  fr: { lang: "fr", country: "フランス", city: "パリ", average_price_jpy: 4200 },
  zh: { lang: "zh", country: "中国", city: "北京", average_price_jpy: 2300 },
  "zh-TW": { lang: "zh-TW", country: "台湾", city: "台北", average_price_jpy: 1600 },
  ko: { lang: "ko", country: "韓国", city: "ソウル", average_price_jpy: 2700 },

  es: { lang: "es", country: "スペイン", city: "マドリード" },
  de: { lang: "de", country: "ドイツ", city: "ベルリン" },
  pt: { lang: "pt", country: "ポルトガル", city: "リスボン" },
  it: { lang: "it", country: "イタリア", city: "ローマ" },
  ru: { lang: "ru", country: "ロシア", city: "モスクワ" },
  th: { lang: "th", country: "タイ", city: "バンコク" },
  vi: { lang: "vi", country: "ベトナム", city: "ハノイ" },
  id: { lang: "id", country: "インドネシア", city: "ジャカルタ" },
  hi: { lang: "hi", country: "インド", city: "デリー" },
  ar: { lang: "ar", country: "サウジアラビア", city: "リヤド" },
};

/* =========================
   Pageit プリセット（選ぶと即反映）
   ※従来の6言語のみ数値、他は未設定（空欄）
   ========================= */
const PAGEIT_PRESETS = {
  entry: {
    label: "Entry（集客重視）",
    thresholds: {
      ja: 3980,
      en: 15000,
      fr: 15000,
      zh: 8000,
      "zh-TW": 5980,
      ko: 10000,
    } as NumDict,
  },
  standard: {
    label: "Standard（推奨・初期値）",
    thresholds: {
      ja: 4980,
      en: 18000,
      fr: 18000,
      zh: 9800,
      "zh-TW": 6980,
      ko: 12000,
    } as NumDict,
  },
  pro: {
    label: "Pro（利益重視）",
    thresholds: {
      ja: 5500,
      en: 22000,
      fr: 22000,
      zh: 12000,
      "zh-TW": 8000,
      ko: 14000,
    } as NumDict,
  },
} as const;
type PresetKey = keyof typeof PAGEIT_PRESETS;

/* =========================
   Helpers
   ========================= */
function toIntOrEmpty(v: string): number | "" {
  if (v === "") return "";
  const n = Math.max(0, Math.floor(Number(v) || 0));
  return Number.isFinite(n) ? n : 0;
}

/* 差分比較用（順序安定） */
function stableStringify(value: any): string {
  const seen = new WeakSet();
  const _s = (v: any): string => {
    if (v === undefined) return '"__undef"';
    if (v === null || typeof v !== "object") return JSON.stringify(v);
    if (seen.has(v)) return '"__cycle"';
    seen.add(v);
    if (Array.isArray(v)) return `[${v.map(_s).join(",")}]`;
    const obj = v as Record<string, any>;
    const keys = Object.keys(obj).sort();
    return `{${keys.map((k) => JSON.stringify(k) + ":" + _s(obj[k])).join(",")}}`;
  };
  return _s(value);
}

/* 永続化対象だけ抽出（空欄除外・整数化） */
function buildPersistShape(
  prices: NumOrEmptyDict,
  thresholdByLang: NumOrEmptyDict,
  enabled: boolean
) {
  const clean = (src: NumOrEmptyDict): NumDict => {
    const dst: NumDict = {};
    for (const [k, v] of Object.entries(src) as [LangKey, number | ""][]) {
      if (typeof v === "number" && Number.isFinite(v)) {
        dst[k] = Math.max(0, Math.floor(v));
      }
    }
    return dst;
  };
  return {
    enabled: !!enabled,
    prices: clean(prices),
    thresholds: clean(thresholdByLang),
  };
}

/* =========================
   Component
   ========================= */
export default function ShippingPriceSettingPage() {
  const siteKey = useSiteKey();
  // 送料・閾値
  const [prices, setPrices] = useState<NumOrEmptyDict>({}); // 初期は空（自動で推定値を入れない）
  const [thresholdByLang, setThresholdByLang] = useState<NumOrEmptyDict>({});
  const [enabled, setEnabled] = useState<boolean>(true);

  // 状態
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preset, setPreset] = useState<PresetKey>("standard");

  /* ---------- 初期ロード（完了時に baseline を確定） ---------- */
  const baselineRef = useRef<string>(""); // これが空の間は dirty 判定を無効化
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);

        // 一旦ローカル変数に読み込み（state反映前に baseline を確定するため）
        let loadedPrices: NumOrEmptyDict = {};
        let loadedEnabled = true;
        let loadedThresholds: NumOrEmptyDict = {};

        // 送料
        const priceSnap = await getDoc(doc(db, "siteShippingPrices", siteKey));
        loadedPrices = priceSnap.exists()
          ? ((priceSnap.data() as NumDict) || {})
          : {};

        // 送料無料（ドキュメント無い場合は「空欄」を初期値にする）
        const policySnap = await getDoc(doc(db, "siteShippingPolicy", siteKey));
        if (policySnap.exists()) {
          const p = (policySnap.data() as ShippingPolicyDoc) || {};
          loadedEnabled = p.enabled !== false;
          loadedThresholds = Object.fromEntries(
            LANG_KEYS.map((k) => [k, (p.thresholdByLang || {})[k] ?? ""])
          ) as NumOrEmptyDict;
        } else {
          loadedEnabled = true;
          loadedThresholds = Object.fromEntries(
            LANG_KEYS.map((k) => [k, ""])
          ) as NumOrEmptyDict;
        }

        if (!cancelled) {
          setPrices(loadedPrices);
          setEnabled(loadedEnabled);
          setThresholdByLang(loadedThresholds);

          // ★ 初期ロード結果で baseline を確定（これがないと初回からオレンジになる）
          baselineRef.current = stableStringify(
            buildPersistShape(loadedPrices, loadedThresholds, loadedEnabled)
          );
        }
      } catch (e: any) {
        console.error("[ShippingSetting] load error:", e?.message || e);
        if (!cancelled) {
          const fallbackThresholds = Object.fromEntries(
            LANG_KEYS.map((k) => [k, ""])
          ) as NumOrEmptyDict;

          setPrices({});
          setEnabled(true);
          setThresholdByLang(fallbackThresholds);

          // エラー時も baseline を確定（空送料＋空閾値）
          baselineRef.current = stableStringify(
            buildPersistShape({}, fallbackThresholds, true)
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ---------- 差分検知（baseline 確定後のみ有効） ---------- */
  const snapshot = useMemo(
    () => stableStringify(buildPersistShape(prices, thresholdByLang, enabled)),
    [prices, thresholdByLang, enabled]
  );
  const isPrimed = baselineRef.current.length > 0;
  const isDirty = isPrimed && snapshot !== baselineRef.current;

  /* ---------- ハンドラ ---------- */
  const onPriceChange = (lang: LangKey, v: string) =>
    setPrices((prev) => ({ ...prev, [lang]: toIntOrEmpty(v) }));

  const onThresholdChange = (lang: LangKey, v: string) =>
    setThresholdByLang((prev) => ({ ...prev, [lang]: toIntOrEmpty(v) }));

  // プリセット変更＝即反映（閾値のみ）
  const onPresetChange = (key: PresetKey) => {
    setPreset(key);
    const t = PAGEIT_PRESETS[key].thresholds;
    setThresholdByLang(
      Object.fromEntries(
        LANG_KEYS.map((k) => [k, typeof t[k] === "number" ? t[k]! : ""])
      ) as NumOrEmptyDict
    );
  };

  // 参考送料を一括反映（設定がある言語だけ上書き）
  const applyHintPrices = () => {
    setPrices(
      Object.fromEntries(
        LANG_KEYS.map((k) => [k, HINTS[k]?.average_price_jpy ?? ""])
      ) as NumOrEmptyDict
    );
  };

  // 閾値を全て空に（＝その言語は送料無料なし）
  const clearThresholds = () => {
    setThresholdByLang(
      Object.fromEntries(LANG_KEYS.map((k) => [k, ""])) as NumOrEmptyDict
    );
  };

  // 全て削除：送料も閾値も空にし、送料無料を無効化（保存で反映）
  const deleteAllLocal = () => {
    const empty = Object.fromEntries(LANG_KEYS.map((k) => [k, ""])) as NumOrEmptyDict;
    setPrices(empty);
    setThresholdByLang(empty);
    setEnabled(false);
  };

  /* ---------- 保存 ---------- */
  const saveAll = async () => {
    setSaving(true);
    try {
      const cleanPrices: NumDict = {};
      for (const [k, v] of Object.entries(prices) as [LangKey, number | ""][]) {
        if (typeof v === "number") cleanPrices[k] = v;
      }
      const cleanThresholds: NumDict = {};
      for (const [k, v] of Object.entries(thresholdByLang) as [LangKey, number | ""][]) {
        if (typeof v === "number") cleanThresholds[k] = v;
      }

      await Promise.all([
        setDoc(doc(db, "siteShippingPrices", siteKey), cleanPrices),
        setDoc(
          doc(db, "siteShippingPolicy", siteKey),
          { enabled, thresholdByLang: cleanThresholds } as ShippingPolicyDoc,
          { merge: true }
        ),
      ]);

      // 保存成功 → 基準を更新（オレンジ解除）
      baselineRef.current = snapshot;

      alert("設定を保存しました");
    } catch (e: any) {
      console.error("[ShippingSetting] save error:", e?.message || e);
      alert(e?.message || "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  /* ---------- 補助 ---------- */
  const anyThresholds = useMemo(
    () => Object.values(thresholdByLang).some((v) => v !== "" && v != null),
    [thresholdByLang]
  );

  /* ---------- UI ---------- */
  return (
    <div className="max-w-6xl mx-auto px-4 pt-6 pb-28 space-y-6">
      <h1 className="text-xl font-bold text-black">
        各国の送料・「◯円以上で送料無料」設定
      </h1>
      <p className="text-sm text-black">
        「◯円以上で送料無料」は、
        <strong>その地域のご注文金額がこの金額を超えると送料が0円</strong>
        になる仕組みです。
        <br className="hidden sm:block" />
        プリセットを<strong>選ぶだけで即反映</strong>
        されます。必要なら各国ごとに手で上書きしてください。
      </p>

      {/* 上部：ON/OFF & プリセット（選ぶと即反映） */}
      <Card className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="size-4"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <span className="text-sm">「◯円以上で送料無料」を有効にする</span>
          </label>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700">プリセット</span>
              <select
                className="h-9 w-full rounded-md border px-2 text-sm"
                value={preset}
                onChange={(e) => onPresetChange(e.target.value as PresetKey)}
              >
                <option value="entry">{PAGEIT_PRESETS.entry.label}</option>
                <option value="standard">{PAGEIT_PRESETS.standard.label}</option>
                <option value="pro">{PAGEIT_PRESETS.pro.label}</option>
              </select>
            </div>
            <p className="text-xs text-gray-500">
              選んだプリセットに合わせて、下の
              <strong>「送料無料になる金額」</strong>が自動更新されます。
            </p>
          </div>
        </div>

        {/* 一括操作（モバイル：縦／sm以上：横） */}
        <div className="sm:overflow-x-auto">
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:min-w-max w-full">
            <Button
              className="w-full sm:w-auto sm:shrink-0"
              variant="outline"
              onClick={applyHintPrices}
            >
              参考送料で一括入力（各地域）
            </Button>

            <Button
              className="w-full sm:w-auto sm:shrink-0"
              variant="outline"
              onClick={clearThresholds}
              disabled={!anyThresholds}
            >
              「送料無料になる金額」を全て空にする
            </Button>

            <Button
              className="w-full sm:w-auto sm:shrink-0"
              variant="destructive"
              onClick={deleteAllLocal}
            >
              全て削除（送料・送料無料ライン・OFF）
            </Button>
          </div>
        </div>

        {loading && <p className="text-xs text-gray-500">読み込み中…</p>}
      </Card>

      {/* 地域ごとの設定カード（レスポンシブ） */}
      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {LANG_DEFS.map(({ key, label, emoji }) => {
            const hint = HINTS[key];
            const priceVal = prices[key] ?? "";
            const thrVal = thresholdByLang[key] ?? "";
            const presetThr = PAGEIT_PRESETS[preset].thresholds[key];

            const refPrice = typeof hint?.average_price_jpy === "number"
              ? hint!.average_price_jpy!.toLocaleString()
              : undefined;

            return (
              <Card key={key} className="p-4">
                <div className="min-w-0">
                  <p className="font-semibold flex items-center gap-2">
                    <span className="text-lg">{emoji}</span>
                    <span>{label}</span>
                    <span className="text-xs text-gray-500">({key})</span>
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {hint?.country}（{hint?.city}）
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    参考送料： {refPrice ? `約 ${refPrice} 円` : "未設定"}
                  </p>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-gray-600">
                      この地域の送料（JPY）
                    </label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      placeholder={refPrice ? `${refPrice}（参考）` : "未設定"}
                      value={priceVal as any}
                      onChange={(e) => onPriceChange(key, e.target.value)}
                    />
                    <p className="text-[11px] text-gray-400">
                      未入力のままでもOK。カートでは送料を表示しません。
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-gray-600">
                      この地域の「◯円以上で送料無料」
                      <span className="ml-1 text-[11px] text-gray-400">
                        （空欄＝対象外）
                      </span>
                    </label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      placeholder={
                        typeof presetThr === "number"
                          ? `${presetThr.toLocaleString()}（プリセット）`
                          : "未設定"
                      }
                      value={thrVal as any}
                      onChange={(e) => onThresholdChange(key, e.target.value)}
                    />
                    {typeof presetThr === "number" && (
                      <p className="text-[11px] text-gray-400">
                        目安：{presetThr.toLocaleString()} 円（
                        {PAGEIT_PRESETS[preset].label}）
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* 下部アクションバー（sticky） */}
      <div className="sticky bottom-3 z-10">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-xl bg-white/90 backdrop-blur shadow-lg p-3 border flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
            <div className="text-sm text-gray-600">
              入力内容を保存してサイトに反映します。送料無料を無効にしたい場合は上のチェックを外してください。
            </div>
            <div className="flex gap-2">
              <Button
                onClick={saveAll}
                disabled={saving || !isPrimed}
                className={isDirty && !saving ? "bg-orange-500 hover:bg-orange-600 text-white" : undefined}
              >
                {saving ? "保存中..." : "設定を保存する"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
