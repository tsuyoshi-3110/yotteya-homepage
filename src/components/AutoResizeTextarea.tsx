import { useCallback, useEffect, useRef } from "react";
import { Textarea } from "./ui/textarea";

/* ========= 自動伸縮 Textarea ========= */
export default function AutoResizeTextarea({
  value,
  onValueChange,
  minRows = 3,
  maxRows = 50,
  className,
  ...rest
}: {
  value: string;
  onValueChange: (v: string) => void;
  minRows?: number;
  maxRows?: number;
  className?: string;
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;

    el.style.height = "auto";

    const lhRaw = parseFloat(window.getComputedStyle(el).lineHeight || "0");
    const lineHeight = Number.isFinite(lhRaw) && lhRaw > 0 ? lhRaw : 24;

    const minH = lineHeight * minRows;
    const maxH = lineHeight * maxRows;
    const nextH = Math.min(Math.max(el.scrollHeight, minH), maxH);

    el.style.height = `${nextH}px`;
    el.style.overflowY = el.scrollHeight > nextH ? "auto" : "hidden";
  }, [minRows, maxRows]);

  useEffect(() => {
    resize();
  }, [value, resize]);

  useEffect(() => {
    const handler = () => resize();
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [resize]);

  return (
    <Textarea
      ref={ref}
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      className={["resize-none", className].filter(Boolean).join(" ")}
      {...rest}
    />
  );
}
