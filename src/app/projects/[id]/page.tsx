// src/app/products/[id]/page.tsx
"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import ProjectsDetail from "@/components/ProjectsDetail";
import CardSpinner from "@/components/CardSpinner";
import { useSiteKey } from "@/lib/atoms/siteKeyAtom";

export default function ProductPage() {
  const siteKey = useSiteKey();
  const { id } = useParams() as { id: string };
  const [product, setProduct] = useState<any | null>(null);

  useEffect(() => {
    (async () => {
      const snap = await getDoc(doc(db, "siteProjects", siteKey, "items", id));
      if (snap.exists()) setProduct({ id, ...snap.data() });
    })();
  }, [id]);

  if (!product) return <CardSpinner />;
  return <ProjectsDetail product={product} />;
}
