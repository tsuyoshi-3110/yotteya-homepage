// src/app/products/[id]/page.tsx
"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import ProductDetail from "@/components/ProductDetail";

const SITE_KEY = "yotteya";

export default function ProductPage() {
  const { id } = useParams() as { id: string };
  const [product, setProduct] = useState<any | null>(null);

  useEffect(() => {
    (async () => {
      const snap = await getDoc(
        doc(db, "siteProducts", SITE_KEY, "items", id)
      );
      if (snap.exists()) setProduct({ id, ...snap.data() });
    })();
  }, [id]);

  if (!product) return <p className="text-center pt-20">Loading...</p>;

  return <ProductDetail product={product} />;
}
