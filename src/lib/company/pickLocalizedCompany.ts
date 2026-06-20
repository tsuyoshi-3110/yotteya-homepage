import { CompanyDoc, CompanyProfileView, TranslatedPack } from "@/types/company";
import { readBaseFromDoc } from "./readBaseFromDoc";


export function pickLocalizedCompany(
  d: CompanyDoc | null | undefined,
  lang: string
): CompanyProfileView {
  const base = readBaseFromDoc(d);
  const t = Array.isArray(d?.t) ? (d!.t as TranslatedPack[]) : [];
  const hit = lang === "ja" ? null : t.find((x) => x.lang === lang);

  const name = (hit?.name ?? base.name).toString();
  const tagline = (hit?.tagline ?? base.tagline) || "";
  const about = (hit?.about ?? base.about) || "";
  const business =
    Array.isArray(hit?.business) && hit!.business!.length > 0
      ? hit!.business!
      : base.business;
  const address = (hit?.address ?? base.address) || "";

  return {
    name,
    tagline,
    about,
    business,
    address,
    founded: d?.founded ?? "",
    ceo: d?.ceo ?? "",
    capital: d?.capital ?? "",
    employees: d?.employees ?? "",
    phone: d?.phone ?? "",
    email: d?.email ?? "",
    website: d?.website ?? "",
    heroMediaUrl: d?.heroMediaUrl ?? "",
    heroMediaType: d?.heroMediaType ?? null,
    useAddressForMap: d?.useAddressForMap ?? true,
  };
}
