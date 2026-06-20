/* ---------- TextColorPicker.tsx ---------- */
"use client";

import { useState, useEffect, useRef } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { SITE_KEY } from "@/lib/atoms/siteKeyAtom";

/* ───────── プリセット ───────── */
const PRESETS_DARK = [
  { label: "ほぼ黒",       value: "#1a1a1a" },
  { label: "ダークグレー", value: "#333333" },
  { label: "グレー",       value: "#555555" },
  { label: "ネイビー",     value: "#0f2050" },
  { label: "ダークブラウン", value: "#3b2a1a" },
  { label: "白",           value: "#ffffff" },
];

const PRESETS_NAV = [
  { label: "黒",           value: "#000000" },
  { label: "ダークグレー", value: "#222222" },
  { label: "ネイビー",     value: "#0f2050" },
  { label: "ダークブラウン", value: "#2d1a0a" },
  { label: "白",           value: "#ffffff" },
  { label: "ライトグレー", value: "#dddddd" },
];

const PRESETS_OUTLINE = [
  { label: "黒",   value: "#000000" },
  { label: "グレー", value: "#333333" },
  { label: "ネイビー", value: "#0f2050" },
  { label: "白",   value: "#ffffff" },
  { label: "赤",   value: "#cc0000" },
  { label: "ゴールド", value: "#b8860b" },
];

/* ───────── 型 ───────── */
type ColorField = "textColorBody" | "textColorTitle" | "textColorHeader" | "textColorMenu";

const CSS_VAR_MAP: Record<ColorField, string> = {
  textColorBody:   "--text-color-body",
  textColorTitle:  "--text-color-title",
  textColorHeader: "--text-color-header",
  textColorMenu:   "--text-color-menu",
};

/* ───────── ColorSwatch ───────── */
interface SwatchProps {
  presets: { label: string; value: string }[];
  current: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

function ColorSwatch({ presets, current, onChange, disabled }: SwatchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isCustom = !presets.some((p) => p.value === current);

  return (
    <div className="flex flex-wrap items-center gap-2 mt-1">
      {presets.map((p) => (
        <button
          key={p.value}
          title={p.label}
          disabled={disabled}
          onClick={() => onChange(p.value)}
          className={`w-7 h-7 rounded-full border-2 shadow-sm transition-all hover:scale-110 ${
            current === p.value
              ? "border-gray-700 ring-2 ring-offset-1 ring-gray-400 scale-110"
              : "border-gray-200"
          }`}
          style={{ backgroundColor: p.value }}
        />
      ))}

      {/* カスタム */}
      <div className="relative">
        <button
          title="カスタム"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className={`w-7 h-7 rounded-full border-2 shadow-sm transition-all hover:scale-110 flex items-center justify-center text-[10px] font-bold ${
            isCustom
              ? "border-gray-700 ring-2 ring-offset-1 ring-gray-400 scale-110"
              : "border-gray-200"
          }`}
          style={{ backgroundColor: current }}
        >
          <span style={{ color: current === "#ffffff" ? "#666" : "#fff", textShadow: "0 0 2px rgba(0,0,0,.4)" }}>
            ＋
          </span>
        </button>
        <input
          ref={inputRef}
          type="color"
          value={current.startsWith("#") ? current : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
          tabIndex={-1}
        />
      </div>

      <span className="text-[11px] text-gray-400 font-mono">{current}</span>
    </div>
  );
}

/* ───────── Row ───────── */
function Row({
  label,
  presets,
  current,
  onChange,
  disabled,
}: {
  label: string;
  presets: { label: string; value: string }[];
  current: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="py-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <ColorSwatch presets={presets} current={current} onChange={onChange} disabled={disabled} />
    </div>
  );
}

/* ───────── Toggle ───────── */
function Toggle({ on, onToggle }: { on: boolean; onToggle: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onToggle(!on)}
      className={`relative inline-flex w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none ${
        on ? "bg-blue-500" : "bg-gray-300"
      }`}
      aria-checked={on}
      role="switch"
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
          on ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

/* ───────── タブ ───────── */
type Tab = "content" | "nav" | "outline";

const TABS: { id: Tab; label: string; emoji: string }[] = [
  { id: "content", label: "コンテンツ",     emoji: "📄" },
  { id: "nav",     label: "ナビゲーション", emoji: "🧭" },
  { id: "outline", label: "縁取り",         emoji: "✏️" },
];

/* ───────── 本体 ───────── */
function applyOutline(enabled: boolean, color: string) {
  document.documentElement.style.setProperty(
    "--text-outline-color",
    enabled ? color : "transparent"
  );
}

export default function TextColorPicker() {
  const [tab, setTab] = useState<Tab>("content");
  const [colors, setColors] = useState<Record<ColorField, string>>({
    textColorBody:   "#1a1a1a",
    textColorTitle:  "#111111",
    textColorHeader: "#000000",
    textColorMenu:   "#000000",
  });
  const [outlineEnabled, setOutlineEnabled] = useState(false);
  const [outlineColor, setOutlineColor]     = useState("#000000");
  const [saving, setSaving] = useState(false);

  /* 初回ロード */
  useEffect(() => {
    (async () => {
      const snap = await getDoc(doc(db, "assets", SITE_KEY));
      if (!snap.exists()) return;
      const data = snap.data();

      const fields: ColorField[] = ["textColorBody", "textColorTitle", "textColorHeader", "textColorMenu"];
      const updates: Partial<Record<ColorField, string>> = {};
      for (const f of fields) {
        if (data[f]) {
          updates[f] = data[f];
          document.documentElement.style.setProperty(CSS_VAR_MAP[f], data[f]);
        }
      }
      if (Object.keys(updates).length) setColors((p) => ({ ...p, ...updates }));

      const en  = data.textOutlineEnabled === true;
      const col = data.textOutlineColor ?? "#000000";
      setOutlineEnabled(en);
      setOutlineColor(col);
      applyOutline(en, col);
    })();
  }, []);

  /* 文字色変更 */
  const changeColor = async (field: ColorField, value: string) => {
    setColors((p) => ({ ...p, [field]: value }));
    document.documentElement.style.setProperty(CSS_VAR_MAP[field], value);
    setSaving(true);
    try { await setDoc(doc(db, "assets", SITE_KEY), { [field]: value }, { merge: true }); }
    finally { setSaving(false); }
  };

  /* 枠 ON/OFF */
  const toggleOutline = async (enabled: boolean) => {
    setOutlineEnabled(enabled);
    applyOutline(enabled, outlineColor);
    setSaving(true);
    try { await setDoc(doc(db, "assets", SITE_KEY), { textOutlineEnabled: enabled }, { merge: true }); }
    finally { setSaving(false); }
  };

  /* 枠色変更 */
  const changeOutlineColor = async (color: string) => {
    setOutlineColor(color);
    if (outlineEnabled) applyOutline(true, color);
    setSaving(true);
    try { await setDoc(doc(db, "assets", SITE_KEY), { textOutlineColor: color }, { merge: true }); }
    finally { setSaving(false); }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white/80 overflow-hidden flex">
      {/* 縦タブバー */}
      <div className="flex flex-col border-r border-gray-200 bg-gray-50 min-w-[7rem]">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`py-3 px-3 text-xs font-semibold text-left transition-colors flex items-center gap-1.5 ${
              tab === t.id
                ? "bg-white text-blue-600 border-r-2 border-blue-500"
                : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            <span>{t.emoji}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* パネル */}
      <div className="flex-1 px-4 pb-4 pt-2 divide-y divide-gray-100">

        {/* ── コンテンツ ── */}
        {tab === "content" && (
          <>
            <Row
              label="本文"
              presets={PRESETS_DARK}
              current={colors.textColorBody}
              onChange={(v) => changeColor("textColorBody", v)}
              disabled={saving}
            />
            <Row
              label="見出し・タイトル"
              presets={PRESETS_DARK}
              current={colors.textColorTitle}
              onChange={(v) => changeColor("textColorTitle", v)}
              disabled={saving}
            />
          </>
        )}

        {/* ── ナビゲーション ── */}
        {tab === "nav" && (
          <>
            <Row
              label="ヘッダー（ロゴ・ボタン）"
              presets={PRESETS_NAV}
              current={colors.textColorHeader}
              onChange={(v) => changeColor("textColorHeader", v)}
              disabled={saving}
            />
            <Row
              label="メニュー（スライドメニュー内）"
              presets={PRESETS_NAV}
              current={colors.textColorMenu}
              onChange={(v) => changeColor("textColorMenu", v)}
              disabled={saving}
            />
          </>
        )}

        {/* ── 縁取り ── */}
        {tab === "outline" && (
          <div className="pt-3 space-y-4">
            <p className="text-xs text-gray-500">
              タイトル・見出しに文字の縁取り（アウトライン）を付けます。
            </p>

            {/* ON/OFF */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">縁取り</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{outlineEnabled ? "ON" : "OFF"}</span>
                <Toggle on={outlineEnabled} onToggle={toggleOutline} />
              </div>
            </div>

            {/* 枠色 */}
            {outlineEnabled && (
              <div className="border-t border-gray-100 pt-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">枠の色</p>
                <ColorSwatch
                  presets={PRESETS_OUTLINE}
                  current={outlineColor}
                  onChange={changeOutlineColor}
                  disabled={saving}
                />
              </div>
            )}

            {!outlineEnabled && (
              <p className="text-xs text-gray-400 italic">
                ONにすると枠色を選べます。
              </p>
            )}
          </div>
        )}
      </div>

      {/* 保存中インジケーター */}
      {saving && (
        <div className="px-4 py-1 bg-blue-50 text-xs text-blue-500 text-center">保存中…</div>
      )}
    </div>
  );
}
