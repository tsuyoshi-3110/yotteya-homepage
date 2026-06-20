// src/lib/jsonld/store.ts
import type { DocumentData } from "firebase/firestore";
import { CUSTOMER } from "@/config/customer";

/* =========================
   Helpers
========================= */

/** 末尾スラッシュ除去 */
const trimSlash = (u: string) => u.replace(/\/$/, "");

/** 相対→絶対URL（先頭スラ無しも許容）。未指定時は fallbackPath を付与 */
const toAbs = (
  u: string | undefined,
  siteUrl: string,
  fallbackPath = "/images/ogpLogo.png"
) => {
  const root = trimSlash(siteUrl || "");
  if (!u || typeof u !== "string") return `${root}${fallbackPath}`;
  if (/^https?:\/\//i.test(u)) return u;
  return `${root}${u.startsWith("/") ? u : `/${u}`}`;
};

/** URL配列を絶対化＋重複除去 */
const toAbsList = (list: (string | undefined)[] | undefined, siteUrl: string) =>
  Array.from(
    new Set(
      (list ?? []).filter(Boolean).map((u) => toAbs(u as string, siteUrl))
    )
  );

/** JPのTELをざっくりE.164(+81)化（失敗時はそのまま） */
const toE164JP = (tel?: string) => {
  if (!tel) return undefined;
  const digits = tel.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("0")) return `+81${digits.slice(1)}`;
  return digits || undefined;
};

/** OpeningHoursSpecification 正規化（無ければ既定：月〜土 09:00-18:00） */
const normalizeOpeningHours = (raw: any): any[] => {
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((r) => {
      if (!r || typeof r !== "object") return r;
      const days = Array.isArray(r.dayOfWeek)
        ? r.dayOfWeek
        : r.dayOfWeek
        ? [r.dayOfWeek]
        : undefined;
      return {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: days ?? [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ],
        opens: r.opens ?? CUSTOMER.structuredData.openingHours.opens,
        closes: r.closes ?? CUSTOMER.structuredData.openingHours.closes,
      };
    });
  }
  // default
  return [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: [...CUSTOMER.structuredData.openingHours.dayOfWeek],
      opens: CUSTOMER.structuredData.openingHours.opens,
      closes: CUSTOMER.structuredData.openingHours.closes,
    },
  ];
};

/** 緯度経度を @type 付きで正規化（無ければ顧客設定を使用） */
const normalizeGeo = (d: Record<string, any>) => {
  const g = d.geo ?? { latitude: d.latitude, longitude: d.longitude };
  const lat =
    typeof g?.latitude === "number"
      ? g.latitude
      : CUSTOMER.address.latitude;
  const lng =
    typeof g?.longitude === "number"
      ? g.longitude
      : CUSTOMER.address.longitude;
  return { "@type": "GeoCoordinates", latitude: lat, longitude: lng };
};

/** sameAs の正規化（空文字除去・重複除去） */
const normalizeSameAs = (d: Record<string, any>, siteUrl: string) => {
  const candidates = [
    d.sameAs, // 既に配列かもしれない
    d.instagram,
    d.line,
    d.twitter,
    d.x,
    d.facebook,
    d.youtube,
    d.tiktok,
    // NOTE: 便宜的にサイト自体も含めたい場合は下行を残す
    trimSlash(siteUrl),
  ]
    .flat()
    .filter(Boolean) as string[];

  // 簡易URLバリデーション
  const valid = candidates.filter(
    (u) => typeof u === "string" && /^https?:\/\//i.test(u)
  );
  return Array.from(new Set(valid));
};

/** エリア指定の正規化 */
const normalizeAreaServed = (raw: any): any[] => {
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((x) =>
      typeof x === "string" ? { "@type": "AdministrativeArea", name: x } : x
    );
  }
  return CUSTOMER.structuredData.areaServed.map((name) => ({
    "@type": "AdministrativeArea",
    name,
  }));
};

/* =========================
   Main builder
========================= */

/**
 * 顧客設定に応じた LocalBusiness JSON-LD を生成（欠損OK）
 * - store: Firestoreから取れた任意shape（undefinedでもOK）
 * - siteUrl: ルートURL（例: https://example.com）※末尾スラは自動除去
 */
export function buildStoreJsonLd(
  store: DocumentData | undefined,
  siteUrl: string
) {
  const d = (store ?? {}) as Record<string, any>;
  const root = trimSlash(siteUrl);

  // 基本情報
  const siteName =
    d.siteName ?? d.title ?? d.shopName ?? CUSTOMER.brand.name;
  const description =
    d.description ?? CUSTOMER.structuredData.defaultDescription;
  const url = toAbs(d.url, root, ""); // 相対でも絶対でもOK。未指定は root

  // 代表画像（オーナーが設定した imageUrls の先頭を最優先）
  const heroUrl = toAbs(
    d.imageUrls?.[0] ?? d.heroImageUrl ?? d.imageUrl1 ?? d.imageUrl,
    root,
    "/images/ogpLogo.png"
  );

  // ロゴ（未設定時は OGP でフォールバック）
  const logoUrl = toAbs(
    d.logoUrl ?? d.headerLogoUrl,
    root,
    "/images/ogpLogo.png"
  );

  // image は配列で渡すと採用されやすい（重複除去）
  const images = toAbsList([heroUrl, logoUrl], root);

  // 電話番号
  const telephone =
    toE164JP(d.ownerTel ?? d.tel ?? d.phone) ??
    toE164JP(CUSTOMER.brand.telephone);

  // 住所
  const address = {
    "@type": "PostalAddress",
    streetAddress:
      d.address?.streetAddress ??
      d.streetAddress ??
      CUSTOMER.address.street,
    addressLocality:
      d.address?.addressLocality ?? d.city ?? CUSTOMER.address.locality,
    addressRegion:
      d.address?.addressRegion ?? d.pref ?? CUSTOMER.address.region,
    ...(d.address?.postalCode ??
    d.postalCode ??
    CUSTOMER.address.postalCode
      ? {
          postalCode:
            d.address?.postalCode ??
            d.postalCode ??
            CUSTOMER.address.postalCode,
        }
      : {}),
    addressCountry:
      d.address?.addressCountry ?? CUSTOMER.address.country,
  };

  // 営業時間
  const openingHoursSpecification = normalizeOpeningHours(
    d.openingHoursSpecification
  );

  // 緯度経度
  const geo = normalizeGeo(d);

  // SNS等
  const sameAs = normalizeSameAs(d, root);

  // 提供エリア
  const areaServed = normalizeAreaServed(d.areaServed);

  // 任意: Google マップURLがあれば
  const hasMap = typeof d.hasMap === "string" ? d.hasMap : undefined;

  // 任意: 価格帯（例: "¥" | "¥¥" | "¥¥¥"）
  const priceRange =
    typeof d.priceRange === "string" ? d.priceRange : undefined;

  // 任意: 動画（オーナーが heroVideo を設定していれば VideoObject を付ける）
  const heroVideo =
    d.heroVideo && typeof d.heroVideo === "object"
      ? {
          "@type": "VideoObject",
          name: d.heroVideo.name ?? `${siteName} 紹介動画`,
          description: d.heroVideo.description ?? "サービス紹介動画です。",
          contentUrl: d.heroVideo.contentUrl, // Storage のダウンロードURLでOK
          thumbnailUrl: toAbs(
            d.heroVideo.thumbnailUrl ??
              (typeof d.url === "string"
                ? d.url.replace(/\.mp4(\?.*)?$/i, ".jpg")
                : undefined),
            root,
            "/images/ogpLogo.png"
          ),
          uploadDate: d.heroVideo.uploadDate ?? new Date().toISOString(),
          duration: d.heroVideo.duration, // 例: "PT30S"
        }
      : undefined;

  // エンティティの安定識別子
  const entityId = `${root}#localbusiness`;

  // 返却
  return {
    "@context": "https://schema.org",
    "@type": [...CUSTOMER.structuredData.types],
    "@id": entityId,
    name: siteName,
    description,
    url,
    image: images,
    logo: logoUrl,
    telephone,
    address,
    openingHoursSpecification,
    geo,
    areaServed,
    sameAs,
    ...(hasMap ? { hasMap } : {}),
    ...(priceRange ? { priceRange } : {}),
    ...(heroVideo ? { video: heroVideo } : {}),
  };
}
