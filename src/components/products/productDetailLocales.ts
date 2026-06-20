// src/components/products/productDetailLocales.ts

import { LANGS, type LangKey } from "@/lib/langs";
import type { UILang } from "@/lib/atoms/uiLangAtom";
import type { Product } from "@/types/Product";

/* Product + 多言語フィールド付きの型（元の ProductDoc と同じ構造） */
export type ProductDoc = Product & {
  price: number; // 表示用（常に税込）
  priceIncl?: number;
  priceExcl?: number;
  taxRate?: number;
  base?: { title: string; body: string };
  t?: Array<{ lang: LangKey; title?: string; body?: string }>;
  sectionId?: string | null;
};

/* ▼ 価格を常に number に正規化（未定義/NaNは 0） */
export const normalizePrice = (v: unknown): number => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^\d.-]/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return 0;
};

/* ▼ 表示用：UI 言語に応じてタイトル/本文を解決（元の pickLocalized と同じ） */
export function pickLocalized(
  p: ProductDoc,
  lang: UILang
): { title: string; body: string } {
  if (lang === "ja") {
    return {
      title: p.base?.title ?? p.title ?? "",
      body: p.base?.body ?? p.body ?? "",
    };
  }
  const hit = p.t?.find((x) => x.lang === lang);
  return {
    title: hit?.title ?? p.base?.title ?? p.title ?? "",
    body: hit?.body ?? p.base?.body ?? p.body ?? "",
  };
}

/* ▼ 保存時に日本語→各言語へ翻訳（/api/translate を使用） */
export type Tr = { lang: LangKey; title: string; body: string };

export async function translateAll(
  titleJa: string,
  bodyJa: string
): Promise<Tr[]> {
  const jobs: Promise<Tr>[] = LANGS.map(async (l) => {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: titleJa, body: bodyJa, target: l.key }),
    });
    if (!res.ok) throw new Error(`translate error: ${l.key}`);
    const data = (await res.json()) as { title?: string; body?: string };
    return {
      lang: l.key,
      title: (data.title ?? "").trim(),
      body: (data.body ?? "").trim(),
    };
  });

  const settled = await Promise.allSettled(jobs);

  return settled
    .filter((r): r is PromiseFulfilledResult<Tr> => r.status === "fulfilled")
    .map((r) => r.value);
}
