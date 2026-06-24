// /app/sitemap.ts
import { type MetadataRoute } from "next";
import { loadSitemapFromFirestore } from "@/lib/customer-config/public-routes-server";

export default function sitemap(): Promise<MetadataRoute.Sitemap> {
  return loadSitemapFromFirestore();
}
