// app/video/page.tsx
import { adminDb } from "@/lib/firebase-admin";
export const runtime = "nodejs";
import { resolveCurrentTenant } from "@/lib/customer-config/tenant-resolver-server";

export default async function VideoPage() {
  const tenant = await resolveCurrentTenant();
  const siteKey = tenant.siteKey;
  const snap = await adminDb.collection("siteSettingsEditable").doc(siteKey).get();
  const s = (snap.data() as any) ?? {};
  const v = s.heroVideo ?? {};

  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">{v?.name ?? "紹介動画"}</h1>
      {v?.embedUrl ? (
        <div className="aspect-video">
          <iframe
            src={v.embedUrl}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : v?.contentUrl ? (
        <video className="w-full" controls poster={v?.thumbnailUrl || undefined}>
          <source src={v.contentUrl} />
        </video>
      ) : (
        <p>動画が登録されていません。</p>
      )}
      {v?.description && <p className="mt-4">{v.description}</p>}
    </main>
  );
}
