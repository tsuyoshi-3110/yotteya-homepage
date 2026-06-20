// src/components/productsEC/types.ts
import { LANGS, type LangKey } from "@/lib/langs";
import type { UILang } from "@/lib/atoms/uiLangAtom";
import type { Product } from "@/types/Product";

/* ======================== 型 ======================== */

export type MediaType = "image" | "video";

export type Base = { title: string; body: string };

export type Tr = { lang: LangKey; title?: string; body?: string };

export type Section = {
  id: string;
  base: { title: string };
  t: Array<{ lang: LangKey; title?: string }>;
  createdAt?: any;
  order?: number;
};

export type ProdDoc = Product & {
  base?: Base;
  t?: Tr[];
  sectionId?: string | null;
  published?: boolean;
  taxIncluded?: boolean;
};

/* ===== 表示用多言語 resolve ===== */

export function displayOf(
  p: Product & { base?: Base; t?: Tr[] },
  lang: UILang
): Base {
  const fallback: Base = {
    title: (p as any)?.title ?? "",
    body: (p as any)?.body ?? "",
  };
  if (!p.base && !p.t) return fallback;
  if (lang === "ja") return p.base ?? fallback;
  const hit = p.t?.find((x) => x.lang === lang);
  return {
    title: (hit?.title ?? p.base?.title ?? fallback.title) || "",
    body: (hit?.body ?? p.base?.body ?? fallback.body) || "",
  };
}

export function sectionTitleLoc(s: Section, lang: UILang): string {
  if (lang === "ja") return s.base?.title ?? "";
  const hit = s.t?.find((x) => x.lang === lang);
  return hit?.title ?? s.base?.title ?? "";
}

/* ===== 翻訳（日本語→その他言語） ※ja は除外 ===== */
export async function translateAll(
  titleJa: string,
  bodyJa: string
): Promise<Tr[]> {
  const tasks = LANGS.filter((l) => l.key !== "ja").map(async (l) => {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: titleJa, body: bodyJa, target: l.key }),
    });
    if (!res.ok) throw new Error(`translate failed: ${l.key}`);
    const data = (await res.json()) as { title?: string; body?: string };
    return {
      lang: l.key,
      title: (data.title ?? "").trim(),
      body: (data.body ?? "").trim(),
    };
  });
  return Promise.all(tasks);
}
