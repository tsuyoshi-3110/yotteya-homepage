// /app/robots.ts
import { type MetadataRoute } from "next";
import { loadRobotsFromFirestore } from "@/lib/customer-config/public-routes-server";

export default function robots(): Promise<MetadataRoute.Robots> {
  return loadRobotsFromFirestore();
}
