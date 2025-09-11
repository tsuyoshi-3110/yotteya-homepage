"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { LANGS } from "@/lib/langs";
import { useUILang, type UILang } from "@/lib/atoms/uiLangAtom";

type LangOption = {
  key: UILang;
  label: string;
  emoji: string;
};

const ALL_OPTIONS: ReadonlyArray<LangOption> = LANGS;

const TAP_MOVE_THRESHOLD = 8;   // px 未満ならタップ
const TAP_TIME_THRESHOLD = 500; // ms 未満ならタップ

export default function UILangFloatingPicker() {
  const { uiLang, setUiLang } = useUILang();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // ▼ 自動配置（上/下）と、その時の最大高さ（px）
  const [placement, setPlacement] = useState<"down" | "up">("down");
  const [menuMaxH, setMenuMaxH] = useState<string>("60vh"); // フォールバック

  const current = useMemo<LangOption>(() => {
    return ALL_OPTIONS.find((o) => o.key === uiLang) ?? ALL_OPTIONS[0];
  }, [uiLang]);

  const decidePlacementAndSize = () => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const gutter = 6; // トリガーとの隙間
    const vh = window.innerHeight;

    const spaceAbove = Math.max(0, rect.top - gutter);
    const spaceBelow = Math.max(0, vh - rect.bottom - gutter);

    // どちらに余裕があるかで配置を決定
    const nextPlacement: "down" | "up" =
      spaceBelow >= spaceAbove ? "down" : "up";

    // メニューの最大高さ: 画面の 60vh を上限としつつ、実際の余白にフィット
    const capacity = nextPlacement === "down" ? spaceBelow : spaceAbove;
    const logicalMax = Math.floor(vh * 0.6); // 60vh
    const px = Math.max(Math.min(capacity, logicalMax), 160); // 最低 160px は確保
    setPlacement(nextPlacement);
    setMenuMaxH(`${px}px`);
  };

  // 外側タップで閉じる
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    document.addEventListener("touchstart", handle, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handle);
      document.removeEventListener("touchstart", handle);
    };
  }, [open]);

  // Esc で閉じる
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // 開いた時 & リサイズ/スクロール時に配置を再計算
  useEffect(() => {
    if (!open) return;
    decidePlacementAndSize();
    const onResizeOrScroll = () => decidePlacementAndSize();
    window.addEventListener("resize", onResizeOrScroll);
    window.addEventListener("scroll", onResizeOrScroll, { passive: true });
    return () => {
      window.removeEventListener("resize", onResizeOrScroll);
      window.removeEventListener("scroll", onResizeOrScroll);
    };
  }, [open]);

  const toggle = () => setOpen((v) => !v);

  return (
    <div className="pointer-events-auto mx-auto w-full flex justify-center">
      <div
        className={clsx(
          "relative inline-flex items-center",
          "rounded-xl border bg-transparent backdrop-blur shadow-lg",
          "text-white" // ← トリガーは白を継承
        )}
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        {/* トリガーボタン（ラベル・矢印を白に） */}
        <button
          ref={btnRef}
          type="button"
          onClick={toggle}
          className={clsx(
            "flex items-center gap-2",
            "rounded-lg border bg-transparent",
            "px-3 py-2",
            "text-[16px]",
            "min-h-[44px] min-w-[200px]",
            "cursor-pointer select-none"
          )}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="表示言語を選択"
        >
          <span className="text-lg leading-none">{current.emoji}</span>
          <span className="text-sm truncate text-white">
            {current.label} / {current.key}
          </span>
          <span className="ml-auto text-white/70">▾</span>
        </button>

        {/* メニュー */}
        {open && (
          <div
            ref={menuRef}
            role="listbox"
            className={clsx(
              "absolute left-1/2 -translate-x-1/2",
              placement === "down"
                ? "top-[calc(100%+6px)]"
                : "bottom-[calc(100%+6px)]",
              "z-[9999]",
              "w-[min(92vw,420px)] overflow-auto rounded-xl border",
              "bg-white",
              "text-gray-900",
              "shadow-xl"
            )}
            style={{
              WebkitOverflowScrolling: "touch",
              overscrollBehavior: "contain",
              touchAction: "pan-y",
              maxHeight: menuMaxH,
            }}
          >
            {ALL_OPTIONS.map((o) => (
              <LangRow
                key={o.key}
                option={o}
                active={o.key === uiLang}
                onSelect={(val) => {
                  setUiLang(val);
                  setOpen(false);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** スクロールとタップを判別して、タップ時のみ onSelect を呼ぶ行 */
function LangRow({
  option,
  active,
  onSelect,
}: {
  option: LangOption;
  active: boolean;
  onSelect: (val: UILang) => void;
}) {
  const touchStart = useRef<{ y: number; x: number; t: number } | null>(null);

  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      // マウスは通常クリック
      onClick={() => onSelect(option.key)}
      // タッチは移動・時間で“タップ”判定
      onTouchStart={(e) => {
        const t = e.changedTouches[0];
        touchStart.current = { y: t.clientY, x: t.clientX, t: Date.now() };
      }}
      onTouchEnd={(e) => {
        const start = touchStart.current;
        if (!start) return;
        const t = e.changedTouches[0];
        const dy = Math.abs(t.clientY - start.y);
        const dx = Math.abs(t.clientX - start.x);
        const dt = Date.now() - start.t;

        const isTap =
          dy < TAP_MOVE_THRESHOLD &&
          dx < TAP_MOVE_THRESHOLD &&
          dt < TAP_TIME_THRESHOLD;

        if (isTap) {
          e.preventDefault(); // 300ms 後の click 抑止
          onSelect(option.key);
        }
        touchStart.current = null;
      }}
      className={clsx(
        "w-full text-left px-4 py-3 text-[16px]",
        "hover:bg-gray-100 active:bg-gray-200",
        active && "bg-gray-100"
      )}
      // iOS の誤爆抑止（横パンは無効）
      style={{ touchAction: "pan-y" }}
    >
      <span className="mr-2">{option.emoji}</span>
      {option.label} / {option.key}
    </button>
  );
}
