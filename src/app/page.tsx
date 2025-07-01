// src/app/(routes)/home/page.tsx
"use client";

import BackgroundVideo from "@/components/BackgroundVideo";

export default function HomePage() {
  return (
    <main className="relative bg-transparent">
      {/* 背景動画コンポーネント */}
      <BackgroundVideo />
      {/* ページ内の他のコンテンツがあればここに書く */}
    </main>
  );
}
