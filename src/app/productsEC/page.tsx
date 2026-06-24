// app/products/page.tsx
import type { Metadata } from "next";
import ProductsECClient from "@/components/productsEC/ProductsECClient";
import { seo } from "@/config/site";
import { loadPageMetadataFromFirestore } from "@/lib/customer-config/home-metadata-server";

const CURRENT_METADATA: Metadata = seo.page("products");

export function generateMetadata(): Promise<Metadata> {
  return loadPageMetadataFromFirestore({
    pageKey: "productsEC",
    fallback: CURRENT_METADATA,
  });
}

export default function ProductsPage() {
  return <ProductsECClient />;
}
