// app/head.tsx
import { adminDb } from "@/lib/firebase-admin";
import { buildVideoJsonLd } from "@/lib/jsonld/video";
import { site, pageUrl } from "@/config/site";

export const runtime = "nodejs";
// 設定が頻繁に変わるなら動的配信を強制（不要ならコメントアウトでOK）
export const dynamic = "force-dynamic";

// URLはsite.tsの集中管理値を使用
const SITE_URL = pageUrl("/");

async function fetchSiteSettings() {
  try {
    const snap = await adminDb
      .collection("siteSettingsEditable")
      .doc(site.key) // ← atomsのSITE_KEYではなくsite.tsのkeyを使用
      .get();
    return (snap.data() as any) ?? {};
  } catch {
    return {};
  }
}

const safe = (o: object) => JSON.stringify(o).replace(/</g, "\\u003c");

export default async function Head() {
  const settings = await fetchSiteSettings();

  // 動画設定があれば VideoObject を出力
  const videoLd = buildVideoJsonLd(settings, SITE_URL);

  return (
    <>
      {videoLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safe(videoLd) }}
        />
      )}
    </>
  );
}
