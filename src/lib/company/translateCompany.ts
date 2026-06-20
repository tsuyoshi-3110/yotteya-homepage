import { TranslatableFields, TranslatedPack } from "@/types/company";
import { LangKey } from "../langs";

export async function translateCompany(
  base: Required<TranslatableFields>,
  target: LangKey
): Promise<TranslatedPack> {
  const SEP = "\n---\n";
  type Item =
    | { kind: "name" }
    | { kind: "tagline" }
    | { kind: "about" }
    | { kind: "business"; idx: number }
    | { kind: "address" };

  const items: Item[] = [];
  const payload: string[] = [];

  items.push({ kind: "name" });
  payload.push(base.name || "");
  items.push({ kind: "tagline" });
  payload.push(base.tagline || "");
  items.push({ kind: "about" });
  payload.push(base.about || "");
  (base.business || []).forEach((s, i) => {
    items.push({ kind: "business", idx: i });
    payload.push(s || "");
  });
  items.push({ kind: "address" });
  payload.push(base.address || "");

  const res = await fetch("/api/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "", body: payload.join(SEP), target }),
  });
  if (!res.ok) throw new Error("翻訳APIエラー");
  const data = (await res.json()) as { body?: string };
  const parts = String(data.body ?? "").split(SEP);

  let p = 0;
  const out: TranslatedPack = {
    lang: target,
    name: "",
    tagline: "",
    about: "",
    business: [],
    address: "",
  };

  for (const it of items) {
    const text = (parts[p++] ?? "").trim();
    if (it.kind === "name") out.name = text || base.name;
    if (it.kind === "tagline") out.tagline = text || base.tagline;
    if (it.kind === "about") out.about = text || base.about;
    if (it.kind === "address") out.address = text || base.address;
    if (it.kind === "business") {
      if (!out.business) out.business = [];
      out.business[it.idx] = text || (base.business[it.idx] ?? "");
    }
  }

  if (Array.isArray(out.business)) {
    out.business = (out.business ?? []).map((s) => String(s ?? ""));
  }

  return out;
}
