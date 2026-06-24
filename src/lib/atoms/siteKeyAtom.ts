// lib/atoms/partnerSiteKeyAtom.ts
import { atomWithStorage } from "jotai/utils";
import { CUSTOMER } from "@/config/customer";
export { useSiteKey } from "@/lib/context/SiteKeyContext";

export const partnerSiteKeyAtom = atomWithStorage<string | null>(
  "partnerSiteKey", // localStorage のキー
  null,
);

export const SITE_KEY = CUSTOMER.siteKey;
