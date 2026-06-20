// lib/atoms/partnerSiteKeyAtom.ts
import { atomWithStorage } from "jotai/utils";
import { CUSTOMER } from "@/config/customer";

export const partnerSiteKeyAtom = atomWithStorage<string | null>(
  "partnerSiteKey", // localStorage のキー
  null,
);

export const SITE_KEY = CUSTOMER.siteKey;
