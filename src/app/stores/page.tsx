import type { Metadata } from "next";
import { seo } from "@/config/site";
import StoresPageClient from "@/components/stores/StoresPageClient";

// ★ metadata はサーバー側で定義
export const metadata: Metadata = seo.page("stores");

export default function Page() {
  return <StoresPageClient />;
}
