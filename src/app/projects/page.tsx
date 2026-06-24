// app/projects/page.tsx
import type { Metadata } from "next";
import ProjectsClient from "@/components/ProjectsClient";
import { seo } from "@/config/site";
import { loadPageMetadataFromFirestore } from "@/lib/customer-config/home-metadata-server";

const CURRENT_METADATA: Metadata = seo.page("projects");

export function generateMetadata(): Promise<Metadata> {
  return loadPageMetadataFromFirestore({
    pageKey: "projects",
    fallback: CURRENT_METADATA,
  });
}

export default function ProjectsPage() {
  return <ProjectsClient />;
}
