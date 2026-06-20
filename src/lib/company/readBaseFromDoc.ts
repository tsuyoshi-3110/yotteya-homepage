import { CompanyDoc, TranslatableFields } from "@/types/company";

//テスト
export function readBaseFromDoc(
  d: CompanyDoc | null | undefined
): Required<TranslatableFields> {
  const base: Partial<TranslatableFields> = d?.base ?? {};
  return {
    name: String(base.name ?? d?.name ?? ""),
    tagline: (base.tagline ?? d?.tagline ?? "") || "",
    about: (base.about ?? d?.about ?? "") || "",
    business: Array.isArray(base.business)
      ? base.business
      : Array.isArray(d?.business)
      ? (d!.business as string[])
      : [],
    address: (base.address ?? d?.address ?? "") || "",
  };
}
