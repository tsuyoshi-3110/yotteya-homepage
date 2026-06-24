import type { Metadata } from "next";
import { seo } from "@/config/site";
import StoresPageClient from "@/components/stores/StoresPageClient";
import { loadPageMetadataFromFirestore } from "@/lib/customer-config/home-metadata-server";

const CURRENT_METADATA: Metadata = seo.page("stores");

export function generateMetadata(): Promise<Metadata> {
  return loadPageMetadataFromFirestore({
    pageKey: "stores",
    fallback: CURRENT_METADATA,
  });
}

export default function Page() {
  return <StoresPageClient />;
}
