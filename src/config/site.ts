/*
 * Refactored /config/site.ts
 * 目的：新規 Pageit 作成時に「最小の上書き」だけで全体が組み上がるようにする。
 * 使い方：
 *   1) SITE_BRAND / SITE_OVERRIDES の値だけを書き換える（店舗名・キャッチ・説明など）
 *   2) 必要なら copy, PAGES の文言や画像パスを調整
 *   3) それ以外は触らずに使い回し可能
 */

import type { Metadata } from "next";
import { SITE_KEY } from "@/lib/atoms/siteKeyAtom";
import { type AiSiteConfig } from "@/types/AiSite";
import { type FooterI18n } from "@/types/FooterI18n";
import { type FaqItem } from "@/types/FaqItem";
import { type PageDef } from "@/types/PageDef";
import { CUSTOMER } from "@/config/customer";

/* =========================
   URL / 環境ユーティリティ
========================= */
const PRODUCTION_BASE_URL = CUSTOMER.productionUrl;
const LOCAL_BASE_URL = "http://localhost:3000";
const ENV_BASE_URL_RAW = process.env.NEXT_PUBLIC_APP_URL?.trim();
const ENV_BASE_URL_IS_LOCAL =
  ENV_BASE_URL_RAW === "http://localhost:3000" ||
  ENV_BASE_URL_RAW === "https://localhost:3000" ||
  ENV_BASE_URL_RAW?.startsWith("http://127.0.0.1") ||
  ENV_BASE_URL_RAW?.startsWith("https://127.0.0.1");
const RESOLVED_BASE_URL =
  process.env.NODE_ENV === "production" &&
  (!ENV_BASE_URL_RAW || ENV_BASE_URL_IS_LOCAL)
    ? PRODUCTION_BASE_URL
    : ENV_BASE_URL_RAW || LOCAL_BASE_URL;
const BASE_URL = RESOLVED_BASE_URL.replace(/\/$/, "");

function safeHost(input: string, fallback = "localhost:3000"): string {
  try {
    return new URL(input).host;
  } catch {
    return fallback;
  }
}

function safeMetadataBase(input: string): URL | undefined {
  try {
    return new URL(input);
  } catch {
    return undefined;
  }
}

const DOMAIN = safeHost(BASE_URL);
const METADATA_BASE_SAFE = safeMetadataBase(BASE_URL);

/* =========================
   サイト定義ファクトリ（単一情報源）
========================= */
export type SiteOverrides = {
  /** 店舗名（ブランド名） */
  name: string;
  /** キャッチコピー */
  tagline: string;
  /** サイト説明（OG/SEO 共通） */
  description: string;
  /** 検索キーワード */
  keywords: ReadonlyArray<string>;
  /** 代表TEL（任意） */
  tel?: string;
  /** ロゴ/OG既定パス */
  logoPath?: string;
  /** Google Site Verification（任意） */
  googleSiteVerification?: string;
  /** SNS（任意） */
  socials?: Partial<{
    instagram: string;
    line: string;
    x: string;
    facebook: string;
  }>;
  /** baseUrl を個別指定したい場合のみ */
  baseUrl?: string;
};

function createSite(overrides: SiteOverrides) {
  const baseUrl = (overrides.baseUrl ?? BASE_URL).replace(/\/$/, "");
  const domain = safeHost(baseUrl, DOMAIN);
  return {
    key: SITE_KEY,
    domain,
    baseUrl,
    name: overrides.name,
    tagline: overrides.tagline,
    description: overrides.description,
    keywords: overrides.keywords as readonly string[],
    tel: overrides.tel ?? "",
    logoPath: overrides.logoPath ?? "/images/ogpLogo.png",
    googleSiteVerification: overrides.googleSiteVerification ?? "",
    socials: {
      instagram: overrides.socials?.instagram ?? "",
      line: overrides.socials?.line ?? "",
      x: overrides.socials?.x ?? "",
      facebook: overrides.socials?.facebook ?? "",
    },
  } as const;
}

/* =========================
   ★ 店舗ごとの最小上書き（ここだけ編集）
========================= */
const SITE_BRAND = CUSTOMER.brand.name;

const SITE_OVERRIDES: SiteOverrides = {
  name: CUSTOMER.brand.name,
  tagline: CUSTOMER.brand.tagline,
  description: CUSTOMER.brand.description,
  keywords: CUSTOMER.brand.keywords,
  tel: CUSTOMER.brand.telephone,
  logoPath: CUSTOMER.brand.logoPath,
  googleSiteVerification: CUSTOMER.brand.googleSiteVerification,
  socials: {
    instagram: CUSTOMER.social.instagram,
    line: CUSTOMER.social.line,
    x: CUSTOMER.social.x,
    facebook: CUSTOMER.social.facebook,
  },
};

/* =========================
   サイト定義（以降は原則編集不要）
========================= */
export const siteName = SITE_BRAND; // 互換：従来の siteName を残す
export const site = createSite(SITE_OVERRIDES);

/* =========================
   住所（公開用）←★追加
   ※ ownerAddress は公開しない。SEO/リッチリザルト用にこちらを使う。
========================= */
export type PublicAddress = {
  text: string; // 表示用
  postal: {
    "@type": "PostalAddress";
    addressCountry: "JP";
    addressRegion: string;
    addressLocality: string;
    streetAddress: string;
    postalCode?: string;
  };
  hasMap: string; // Google Maps 検索URL
};
function mapUrlFromText(text: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    text
  )}`;
}

/** 店舗の公開住所（必要に応じてこの値だけ編集） */
export const PUBLIC_ADDRESS: PublicAddress = {
  text: CUSTOMER.address.text,
  postal: {
    "@type": "PostalAddress",
    addressCountry: "JP",
    addressRegion: CUSTOMER.address.region,
    addressLocality: CUSTOMER.address.locality,
    streetAddress: CUSTOMER.address.street,
    ...(CUSTOMER.address.postalCode
      ? { postalCode: CUSTOMER.address.postalCode }
      : {}),
  },
  hasMap: mapUrlFromText(CUSTOMER.address.text),
};

/* =========================
   便利ヘルパ
========================= */
export const pageUrl = (path = "/") =>
  `${site.baseUrl.replace(/\/$/, "")}${
    path.startsWith("/") ? path : `/${path}`
  }`;

const ogImage = (p?: string) => pageUrl(p ?? site.logoPath);

/* =========================
   コピー（集中管理）
========================= */
/* =========================
   コピー（集中管理）★多言語対応
   - copy[lang].home.headline のように参照
   - lang は "ja" | "en" | "zh" | "zh-TW" | ...
========================= */

export type CopyBundle = {
  home: {
    headline: string;
    description: string;
  };
  stores: {
    heroTitle: string;
    heroAreas: string;
    heroLead: string;
    heroTail: string;
    heroIntroLine: string;
  };
  areasLocal: {
    h1: string;
    lead: string;
    services: {
      title: string;
      bullets: string[];
    }[];
    coverageTitle: string;
    coverageBody: string;
    faq: {
      q: string;
      a: string;
    }[];
    contactTitle: string;
    contactText: string;
    toProductsText: string;
  };
};

/**
 * UI 言語ごとの文言。
 * 例：
 *   const t = copy[uiLang] ?? copy["ja"];
 *   t.home.headline
 */
export const copy: Record<string, CopyBundle> = {
  /* ========= 日本語 ========= */
  ja: {
    home: {
      headline: CUSTOMER.home.headline,
      description: CUSTOMER.home.description,
    },
    stores: {
      heroTitle: CUSTOMER.stores.heroTitle,
      heroAreas: CUSTOMER.stores.heroAreas,
      heroLead: CUSTOMER.stores.heroLead,
      heroTail: CUSTOMER.stores.heroTail,
      heroIntroLine: CUSTOMER.stores.heroIntroLine,
    },
    areasLocal: {
      h1: CUSTOMER.localPage.h1,
      lead: CUSTOMER.localPage.lead,
      services: CUSTOMER.localPage.services.map((service) => ({
        title: service.title,
        bullets: [...service.bullets],
      })),
      coverageTitle: CUSTOMER.localPage.coverageTitle,
      coverageBody: CUSTOMER.localPage.coverageBody,
      faq: CUSTOMER.localPage.faq.map((item) => ({ ...item })),
      contactTitle: "お問い合わせ",
      contactText: "ご不明な点はInstagramのDMまたは店頭にてお気軽にどうぞ。",
      toProductsText: "トップページへ",
    },
  },

  /* ========= 英語 ========= */
  en: {
    home: {
      headline: site.name,
      description:
        "We are a crepe specialty shop in Higashiyodogawa and Kita wards, Osaka. Every crepe is made to order, baked fresh from our unique batter. Takeout is available at all locations, and eat-in seating is offered at select stores.",
    },
    stores: {
      heroTitle: `${site.name} ─ Locations`,
      heroAreas: "Higashiyodogawa & Kita, Osaka",
      heroLead: "A crepe specialty shop offering freshly made-to-order crepes.",
      heroTail:
        "From station-front stores to hidden gems in residential areas — check each location's hours and exclusive menus.",
      heroIntroLine: `${site.name} is a crepe specialty shop in Higashiyodogawa and Kita wards, Osaka.`,
    },
    areasLocal: {
      h1: "Crepe Shop in Higashiyodogawa, Osaka",
      lead: "Customers visit us from all over Higashiyodogawa Ward, including Awaji, Kamishinjo, Daido-Toyosato, Itakano, Kunijima and more.",
      services: [
        {
          title: "Popular Menu",
          bullets: [
            "Seasonal fruit crepe (limited)",
            "Custard & fresh cream (house-made sauce)",
            "Chocolate banana / Strawberry milk and more classic flavors",
          ],
        },
        {
          title: "Perfect For",
          bullets: [
            "Takeout & street food",
            "A small gift or treat for someone",
            "Families with kids or post-school snacks",
          ],
        },
      ],
      coverageTitle: "Service area (Higashiyodogawa Ward)",
      coverageBody:
        "Awaji, Higashi-Awaji, Sugahara, Toyoshin, Kamishinjo, Zuiko, Komatsu, Minami-Eguchi, Kita-Eguchi, Itakano, Odori, Osumi, Toyosato, Daido-Minami, Kunijima, Shimoshinjo and surrounding areas.",
      faq: [
        {
          q: "Is takeout available?",
          a: "Yes — all items are available for takeout. Feel free to ask for custom options like extra cream.",
        },
        {
          q: "Do you sometimes sell out?",
          a: "Seasonal and limited items may sell out when ingredients run out. Check our Instagram for the latest updates.",
        },
        {
          q: "What payment methods do you accept?",
          a: "We accept cash and major cashless payment methods. Please check in-store for details.",
        },
      ],
      contactTitle: "Contact",
      contactText:
        "Feel free to reach out via Instagram DM or ask at the counter.",
      toProductsText: "Back to top",
    },
  },

  /* ========= 簡体中文 ========= */
  zh: {
    home: {
      headline: site.name,
      description:
        "本店是位于大阪市东淀川区和北区的可丽饼专卖店。每份可丽饼均按订单现做，使用独特配方的面糊新鲜烘烤。全部商品均可外带，部分门店亦提供堂食服务。",
    },
    stores: {
      heroTitle: `${site.name} ─ 门店一览`,
      heroAreas: "大阪市东淀川区・北区",
      heroLead: "现做现卖的可丽饼专卖店。",
      heroTail: "从车站附近的门店到住宅区的隐藏小店，欢迎查看各店营业时间及限定菜单。",
      heroIntroLine: `${site.name} 是大阪市东淀川区和北区的可丽饼专卖店。`,
    },
    areasLocal: {
      h1: "东淀川区的可丽饼店",
      lead: "欢迎来自淡路、上新庄、大道丰里、井高野、柴岛等东淀川区全域的顾客。",
      services: [
        {
          title: "人气菜单",
          bullets: [
            "季节水果可丽饼（限定）",
            "卡仕达酱＆鲜奶油（自制酱料）",
            "巧克力香蕉／草莓牛奶等经典口味",
          ],
        },
        {
          title: "适合场景",
          bullets: [
            "外带・边走边吃",
            "小礼物・伴手礼",
            "亲子出行・课后零食",
          ],
        },
      ],
      coverageTitle: "服务范围（东淀川区）",
      coverageBody:
        "淡路、东淡路、菅原、丰新、上新庄、瑞光、小松、南江口、北江口、井高野、大桐、大隅、丰里、大道南、柴岛、下新庄等地区。",
      faq: [
        {
          q: "可以外带吗？",
          a: "所有商品均可外带。鲜奶油加量等定制需求也欢迎告知。",
        },
        {
          q: "有时会售罄吗？",
          a: "季节限定菜单可能因食材用完而提前结束销售。最新信息请关注Instagram。",
        },
        {
          q: "支持哪些支付方式？",
          a: "支持现金及主要无现金支付方式。详情请在店内确认。",
        },
      ],
      contactTitle: "联系我们",
      contactText: "如有疑问，欢迎通过Instagram私信或直接到店咨询。",
      toProductsText: "返回首页",
    },
  },

  /* ========= 繁體中文 ========= */
  "zh-TW": {
    home: {
      headline: site.name,
      description:
        "本店是位於大阪市東淀川區和北區的可麗餅專賣店。每份可麗餅均按訂單現做，使用獨特配方的麵糊新鮮烘烤。全部商品均可外帶，部分門店亦提供內用服務。",
    },
    stores: {
      heroTitle: `${site.name} ─ 店鋪一覽`,
      heroAreas: "大阪市東淀川區・北區",
      heroLead: "現做現賣的可麗餅專賣店。",
      heroTail: "從車站附近的門店到住宅區的隱藏小店，歡迎查看各店營業時間及限定菜單。",
      heroIntroLine: `${site.name} 是大阪市東淀川區和北區的可麗餅專賣店。`,
    },
    areasLocal: {
      h1: "東淀川區的可麗餅店",
      lead: "歡迎來自淡路、上新莊、大道豐里、井高野、柴島等東淀川區全域的顧客。",
      services: [
        {
          title: "人氣菜單",
          bullets: [
            "季節水果可麗餅（限定）",
            "卡士達醬＆鮮奶油（自製醬料）",
            "巧克力香蕉／草莓牛奶等經典口味",
          ],
        },
        {
          title: "適合場景",
          bullets: [
            "外帶・邊走邊吃",
            "小禮物・伴手禮",
            "親子出遊・課後點心",
          ],
        },
      ],
      coverageTitle: "服務範圍（東淀川區）",
      coverageBody:
        "淡路、東淡路、菅原、豐新、上新莊、瑞光、小松、南江口、北江口、井高野、大桐、大隅、豐里、大道南、柴島、下新莊等地區。",
      faq: [
        {
          q: "可以外帶嗎？",
          a: "所有商品均可外帶。鮮奶油加量等客製化需求也歡迎告知。",
        },
        {
          q: "有時會售完嗎？",
          a: "季節限定菜單可能因食材用完而提前結束販售。最新資訊請關注Instagram。",
        },
        {
          q: "支援哪些付款方式？",
          a: "支援現金及主要無現金支付方式。詳情請在店內確認。",
        },
      ],
      contactTitle: "聯絡我們",
      contactText: "如有疑問，歡迎透過Instagram私訊或直接到店詢問。",
      toProductsText: "回到首頁",
    },
  },

  /* ========= 韓国語 ========= */
  ko: {
    home: {
      headline: site.name,
      description:
        "저희는 오사카시 히가시요도가와구와 기타구에 있는 크레페 전문점입니다. 주문마다 반죽부터 직접 구워 신선한 크레페를 제공합니다. 모든 매장에서 테이크아웃이 가능하며, 일부 매장에서는 이트인도 이용하실 수 있습니다.",
    },
    stores: {
      heroTitle: `${site.name} ─ 점포 목록`,
      heroAreas: "오사카시 히가시요도가와구・기타구",
      heroLead: "주문 즉시 만들어드리는 크레페 전문점입니다.",
      heroTail:
        "역 근처 매장부터 주택가의 숨은 명소까지, 각 매장의 영업시간 및 한정 메뉴를 확인해 보세요.",
      heroIntroLine: `${site.name}는 오사카시 히가시요도가와구와 기타구에 전개하는 크레페 전문점입니다.`,
    },
    areasLocal: {
      h1: "히가시요도가와구의 크레페 가게",
      lead: "아와지, 가미신조, 다이도토요사토, 이타카노, 쿠니지마 등 히가시요도가와구 전역에서 방문하고 계십니다.",
      services: [
        {
          title: "인기 메뉴",
          bullets: [
            "계절 과일 크레페（한정）",
            "커스터드＆생크림（자가제 소스）",
            "초코바나나 / 딸기우유 등 정번 메뉴",
          ],
        },
        {
          title: "이용 장면",
          bullets: [
            "테이크아웃・길거리 음식",
            "작은 선물・간식 나눔",
            "아이 동반・방과후 간식",
          ],
        },
      ],
      coverageTitle: "서비스 지역（히가시요도가와구）",
      coverageBody:
        "아와지, 히가시아와지, 스가하라, 토요신, 가미신조, 즈이코, 코마츠, 미나미에구치, 키타에구치, 이타카노, 오도리, 오스미, 토요사토, 다이도미나미, 쿠니지마, 시모신조 등",
      faq: [
        {
          q: "테이크아웃이 가능한가요?",
          a: "모든 메뉴 테이크아웃 가능합니다. 생크림 많이 등 커스텀도 편하게 말씀해 주세요.",
        },
        {
          q: "품절이 있나요?",
          a: "계절 한정 메뉴는 재료 소진 시 종료될 수 있습니다. 최신 정보는 Instagram에서 확인해 주세요.",
        },
        {
          q: "결제 방법은 무엇인가요?",
          a: "현금 외에 주요 캐시리스 결제를 지원합니다. 자세한 내용은 매장에서 확인해 주세요.",
        },
      ],
      contactTitle: "문의",
      contactText: "Instagram DM 또는 매장 카운터에서 편하게 문의해 주세요.",
      toProductsText: "맨 위 페이지로",
    },
  },

  /* ========= フランス語 ========= */
  fr: {
    home: {
      headline: site.name,
      description:
        "Nous sommes une crêperie spécialisée dans les quartiers Higashiyodogawa et Kita d’Osaka. Chaque crêpe est préparée à la commande, cuite fraîche selon notre recette exclusive. À emporter dans tous les points de vente, avec service sur place dans certains établissements.",
    },
    stores: {
      heroTitle: `${site.name} ─ Nos boutiques`,
      heroAreas: "Higashiyodogawa & Kita, Osaka",
      heroLead: "Une crêperie spécialisée, tout est fait à la commande.",
      heroTail:
        "Des boutiques en gare aux adresses cachées en quartier résidentiel — consultez les horaires et les menus exclusifs de chaque enseigne.",
      heroIntroLine: `${site.name} est une crêperie spécialisée dans les quartiers Higashiyodogawa et Kita d’Osaka.`,
    },
    areasLocal: {
      h1: "Crêperie à Higashiyodogawa, Osaka",
      lead: "Nos clients viennent de tout le quartier Higashiyodogawa : Awaji, Kamishinjo, Daido-Toyosato, Itakano, Kunijima et bien d’autres.",
      services: [
        {
          title: "Menu populaire",
          bullets: [
            "Crêpe aux fruits de saison (édition limitée)",
            "Crème pâtissière & crème fraîche (sauce maison)",
            "Chocolat-banane / Fraise-lait et autres classiques",
          ],
        },
        {
          title: "Occasions idéales",
          bullets: [
            "À emporter & street food",
            "Petit cadeau ou souvenir gourmand",
            "Sortie en famille ou goûter après l’école",
          ],
        },
      ],
      coverageTitle: "Zone couverte (Higashiyodogawa)",
      coverageBody:
        "Awaji, Higashi-Awaji, Sugahara, Toyoshin, Kamishinjo, Zuiko, Komatsu, Minami-Eguchi, Kita-Eguchi, Itakano, Odori, Osumi, Toyosato, Daido-Minami, Kunijima, Shimoshinjo et environs.",
      faq: [
        {
          q: "La vente à emporter est-elle possible ?",
          a: "Oui, tous les articles sont disponibles à emporter. N’hésitez pas à demander des options personnalisées comme plus de crème.",
        },
        {
          q: "Certains articles peuvent-ils être en rupture de stock ?",
          a: "Les articles saisonniers et en édition limitée peuvent être épuisés quand les ingrédients sont terminés. Consultez notre Instagram pour les dernières infos.",
        },
        {
          q: "Quels moyens de paiement acceptez-vous ?",
          a: "Nous acceptons les espèces et les principaux paiements sans contact. Renseignez-vous en boutique pour les détails.",
        },
      ],
      contactTitle: "Contact",
      contactText: "N’hésitez pas à nous contacter via Instagram DM ou directement en boutique.",
      toProductsText: "Retour à l’accueil",
    },
  },

  /* ========= スペイン語 ========= */
  es: {
    home: {
      headline: site.name,
      description:
        "Somos una crêperie especializada en los barrios Higashiyodogawa y Kita de Osaka. Cada crêpe se prepara al momento, con nuestra masa de receta exclusiva recién horneada. Servicio para llevar en todos los locales y comedor en locales seleccionados.",
    },
    stores: {
      heroTitle: `${site.name} ─ Nuestros locales`,
      heroAreas: "Higashiyodogawa y Kita, Osaka",
      heroLead: "Crêperie especializada con todo elaborado al momento.",
      heroTail:
        "Desde locales junto a la estación hasta rincones escondidos en zonas residenciales — consulta los horarios y los menús exclusivos de cada local.",
      heroIntroLine: `${site.name} es una crêperie especializada en los barrios Higashiyodogawa y Kita de Osaka.`,
    },
    areasLocal: {
      h1: "Crêperie en Higashiyodogawa, Osaka",
      lead: "Nos visitan clientes de todo el barrio Higashiyodogawa: Awaji, Kamishinjo, Daido-Toyosato, Itakano, Kunijima y más.",
      services: [
        {
          title: "Menú popular",
          bullets: [
            "Crêpe de fruta de temporada (edición limitada)",
            "Crema pastelera y nata montada (salsa casera)",
            "Chocolate con plátano / leche de fresa y otros clásicos",
          ],
        },
        {
          title: "Ocasiones perfectas",
          bullets: [
            "Para llevar & comida callejera",
            "Pequeño regalo o detalle",
            "Salida familiar o merienda después del colegio",
          ],
        },
      ],
      coverageTitle: "Zona de cobertura (Higashiyodogawa)",
      coverageBody:
        "Awaji, Higashi-Awaji, Sugahara, Toyoshin, Kamishinjo, Zuiko, Komatsu, Minami-Eguchi, Kita-Eguchi, Itakano, Odori, Osumi, Toyosato, Daido-Minami, Kunijima, Shimoshinjo y alrededores.",
      faq: [
        {
          q: "¿Se puede llevar para llevar?",
          a: "Sí, todos los artículos están disponibles para llevar. No dudes en pedir opciones personalizadas como más nata.",
        },
        {
          q: "¿Hay artículos que se agotan?",
          a: "Los artículos de temporada y de edición limitada pueden agotarse cuando se acaban los ingredientes. Consulta nuestro Instagram para la información más reciente.",
        },
        {
          q: "¿Qué métodos de pago aceptan?",
          a: "Aceptamos efectivo y los principales pagos sin contacto. Consulta en el local para más detalles.",
        },
      ],
      contactTitle: "Contacto",
      contactText: "No dudes en contactarnos por Instagram DM o directamente en el local.",
      toProductsText: "Volver al inicio",
    },
  },

  /* ========= ドイツ語 ========= */
  de: {
    home: {
      headline: site.name,
      description:
        "Wir sind eine spezialisierte Crêperie in den Stadtteilen Higashiyodogawa und Kita in Osaka. Jede Crêpe wird auf Bestellung frisch gebacken – nach unserem einzigartigen Rezept. Zum Mitnehmen an allen Standorten, Sitzplätze an ausgewählten Filialen.",
    },
    stores: {
      heroTitle: `${site.name} ─ Unsere Filialen`,
      heroAreas: "Higashiyodogawa & Kita, Osaka",
      heroLead: "Spezialisierte Crêperie – alles frisch auf Bestellung.",
      heroTail:
        "Von Filialen direkt am Bahnhof bis zu versteckten Läden in Wohngebieten – prüfen Sie Öffnungszeiten und exklusive Menüs jeder Filiale.",
      heroIntroLine: `${site.name} ist eine spezialisierte Crêperie in den Stadtteilen Higashiyodogawa und Kita in Osaka.`,
    },
    areasLocal: {
      h1: "Crêperie in Higashiyodogawa, Osaka",
      lead: "Unsere Gäste kommen aus dem gesamten Bezirk Higashiyodogawa: Awaji, Kamishinjo, Daido-Toyosato, Itakano, Kunijima und mehr.",
      services: [
        {
          title: "Beliebte Speisen",
          bullets: [
            "Saisonale Frucht-Crêpe (limitiert)",
            "Vanillecreme & Schlagsahne (hausgemachte Soße)",
            "Schokolade-Banane / Erdbeer-Milch und weitere Klassiker",
          ],
        },
        {
          title: "Perfekt für",
          bullets: [
            "Zum Mitnehmen & Street Food",
            "Ein kleines Geschenk oder Mitbringsel",
            "Familienausflüge oder Nachmittagssnack nach der Schule",
          ],
        },
      ],
      coverageTitle: "Einzugsgebiet (Bezirk Higashiyodogawa)",
      coverageBody:
        "Awaji, Higashi-Awaji, Sugahara, Toyoshin, Kamishinjo, Zuiko, Komatsu, Minami-Eguchi, Kita-Eguchi, Itakano, Odori, Osumi, Toyosato, Daido-Minami, Kunijima, Shimoshinjo und Umgebung.",
      faq: [
        {
          q: "Ist Mitnahme möglich?",
          a: "Ja, alle Artikel sind zum Mitnehmen verfügbar. Fragen Sie gerne nach individuellen Optionen wie extra Sahne.",
        },
        {
          q: "Kann es zu Ausverkäufen kommen?",
          a: "Saisonale und limitierte Artikel können ausverkauft sein, wenn die Zutaten verbraucht sind. Aktuelle Infos gibt es auf unserem Instagram.",
        },
        {
          q: "Welche Zahlungsmethoden akzeptieren Sie?",
          a: "Wir akzeptieren Bargeld und gängige bargeldlose Zahlungsmethoden. Details erfragen Sie bitte vor Ort.",
        },
      ],
      contactTitle: "Kontakt",
      contactText: "Wenden Sie sich gerne per Instagram-DM oder direkt an unsere Mitarbeiter vor Ort.",
      toProductsText: "Zurück zur Startseite",
    },
  },

  /* ========= ポルトガル語 ========= */
  pt: {
    home: {
      headline: site.name,
      description:
        "Somos uma crêperia especializada nos bairros Higashiyodogawa e Kita de Osaka. Cada crêpe é preparada na hora, assada fresquinha com nossa receita exclusiva. Disponível para viagem em todos os locais e com opção de consumo no local em estabelecimentos selecionados.",
    },
    stores: {
      heroTitle: `${site.name} ─ Nossas lojas`,
      heroAreas: "Higashiyodogawa e Kita, Osaka",
      heroLead: "Crêperia especializada com tudo feito na hora.",
      heroTail:
        "De lojas perto da estação a espaços escondidos em bairros residenciais — confira horários e menus exclusivos de cada loja.",
      heroIntroLine: `${site.name} é uma crêperia especializada nos bairros Higashiyodogawa e Kita de Osaka.`,
    },
    areasLocal: {
      h1: "Crêperia em Higashiyodogawa, Osaka",
      lead: "Nossos clientes vêm de todo o bairro Higashiyodogawa: Awaji, Kamishinjo, Daido-Toyosato, Itakano, Kunijima e mais.",
      services: [
        {
          title: "Menu popular",
          bullets: [
            "Crêpe de fruta da estação (edição limitada)",
            "Creme de confeiteiro & chantilly (molho caseiro)",
            "Chocolate com banana / leite de morango e outros clássicos",
          ],
        },
        {
          title: "Perfeito para",
          bullets: [
            "Viagem & comida de rua",
            "Um pequeno presente ou lembrança",
            "Passeio em família ou lanche pós-escola",
          ],
        },
      ],
      coverageTitle: "Área de cobertura (Higashiyodogawa)",
      coverageBody:
        "Awaji, Higashi-Awaji, Sugahara, Toyoshin, Kamishinjo, Zuiko, Komatsu, Minami-Eguchi, Kita-Eguchi, Itakano, Odori, Osumi, Toyosato, Daido-Minami, Kunijima, Shimoshinjo e arredores.",
      faq: [
        {
          q: "É possível pedir para viagem?",
          a: "Sim, todos os itens estão disponíveis para viagem. Sinta-se à vontade para pedir opções personalizadas como mais chantilly.",
        },
        {
          q: "Alguns itens podem esgotar?",
          a: "Itens sazonais e de edição limitada podem esgotar quando os ingredientes acabam. Confira nosso Instagram para as últimas atualizações.",
        },
        {
          q: "Quais formas de pagamento vocês aceitam?",
          a: "Aceitamos dinheiro e os principais pagamentos sem contato. Consulte na loja para mais detalhes.",
        },
      ],
      contactTitle: "Contato",
      contactText: "Entre em contato pelo DM do Instagram ou pergunte diretamente no balcão.",
      toProductsText: "Voltar ao início",
    },
  },

  /* ========= イタリア語 ========= */
  it: {
    home: {
      headline: site.name,
      description:
        "Siamo una crêperia specializzata nei quartieri Higashiyodogawa e Kita di Osaka. Ogni crêpe è preparata su ordinazione, cotta fresca con la nostra ricetta esclusiva. Disponibile da asporto in tutti i punti vendita e con posti a sedere in locali selezionati.",
    },
    stores: {
      heroTitle: `${site.name} ─ I nostri negozi`,
      heroAreas: "Higashiyodogawa e Kita, Osaka",
      heroLead: "Crêperia specializzata, tutto preparato su ordinazione.",
      heroTail:
        "Dai negozi vicino alla stazione ai locali nascosti nei quartieri residenziali — controlla gli orari e i menù esclusivi di ogni punto vendita.",
      heroIntroLine: `${site.name} è una crêperia specializzata nei quartieri Higashiyodogawa e Kita di Osaka.`,
    },
    areasLocal: {
      h1: "Crêperia a Higashiyodogawa, Osaka",
      lead: "I nostri clienti vengono da tutto il quartiere Higashiyodogawa: Awaji, Kamishinjo, Daido-Toyosato, Itakano, Kunijima e altri.",
      services: [
        {
          title: "Menu più amato",
          bullets: [
            "Crêpe con frutta di stagione (edizione limitata)",
            "Crema pasticcera & panna montata (salsa fatta in casa)",
            "Cioccolato-banana / latte alla fragola e altri classici",
          ],
        },
        {
          title: "Perfetto per",
          bullets: [
            "Asporto & street food",
            "Un piccolo regalo o souvenir",
            "Gita in famiglia o merenda dopo scuola",
          ],
        },
      ],
      coverageTitle: "Area di copertura (Higashiyodogawa)",
      coverageBody:
        "Awaji, Higashi-Awaji, Sugahara, Toyoshin, Kamishinjo, Zuiko, Komatsu, Minami-Eguchi, Kita-Eguchi, Itakano, Odori, Osumi, Toyosato, Daido-Minami, Kunijima, Shimoshinjo e dintorni.",
      faq: [
        {
          q: "È possibile ordinare da asporto?",
          a: "Sì, tutti gli articoli sono disponibili da asporto. Non esitate a chiedere personalizzazioni come più panna.",
        },
        {
          q: "Alcuni articoli possono esaurirsi?",
          a: "Gli articoli stagionali e in edizione limitata possono esaurirsi quando gli ingredienti finiscono. Consultate il nostro Instagram per gli ultimi aggiornamenti.",
        },
        {
          q: "Quali metodi di pagamento accettate?",
          a: "Accettiamo contanti e i principali pagamenti cashless. Chiedete in negozio per i dettagli.",
        },
      ],
      contactTitle: "Contattaci",
      contactText: "Contattateci via Instagram DM o chiedete direttamente al bancone.",
      toProductsText: "Torna all’inizio",
    },
  },

  /* ========= ロシア語 ========= */
  ru: {
    home: {
      headline: site.name,
      description:
        "Мы — специализированная крепери в районах Хигасийодогава и Кита города Осака. Каждый блин готовится под заказ, свежеиспечённый по нашему уникальному рецепту. Возможность взять с собой во всех заведениях; в некоторых точках есть посадочные места.",
    },
    stores: {
      heroTitle: `${site.name} ─ Наши заведения`,
      heroAreas: "Хигасийодогава и Кита, Осака",
      heroLead: "Специализированная крепери — всё готовится под заказ.",
      heroTail:
        "От заведений у станции до скрытых местечек в жилых кварталах — смотрите часы работы и эксклюзивное меню каждой точки.",
      heroIntroLine: `${site.name} — специализированная крепери в районах Хигасийодогава и Кита города Осака.`,
    },
    areasLocal: {
      h1: "Крепери в Хигасийодогава, Осака",
      lead: "К нам приходят гости со всего района Хигасийодогава: Авадзи, Камисиндзё, Дайдо-Тойосато, Итакано, Кунидзима и другие.",
      services: [
        {
          title: "Популярное меню",
          bullets: [
            "Блинчик с сезонными фруктами (лимитированный)",
            "Заварной крем и взбитые сливки (домашний соус)",
            "Шоколад-банан / клубника-молоко и другие классические вкусы",
          ],
        },
        {
          title: "Идеально для",
          bullets: [
            "С собой и уличная еда",
            "Маленький подарок или угощение",
            "Семейная прогулка или перекус после школы",
          ],
        },
      ],
      coverageTitle: "Зона охвата (район Хигасийодогава)",
      coverageBody:
        "Авадзи, Хигаси-Авадзи, Сугавара, Тоёсин, Камисиндзё, Дзуйко, Комацу, Минами-Эгути, Кита-Эгути, Итакано, Одори, Осуми, Тоёсато, Дайдо-Минами, Кунидзима, Симосиндзё и окрестности.",
      faq: [
        {
          q: "Можно взять с собой?",
          a: "Да, все позиции доступны на вынос. Не стесняйтесь просить об индивидуальных опциях — например, больше сливок.",
        },
        {
          q: "Бывает ли, что позиции заканчиваются?",
          a: "Сезонные и лимитированные позиции могут закончиться, когда кончаются ингредиенты. Следите за актуальной информацией в нашем Instagram.",
        },
        {
          q: "Какие способы оплаты вы принимаете?",
          a: "Мы принимаем наличные и основные безналичные способы оплаты. За подробностями обращайтесь в заведение.",
        },
      ],
      contactTitle: "Связаться с нами",
      contactText: "Пишите нам в Instagram DM или спрашивайте прямо за стойкой.",
      toProductsText: "Вернуться на главную",
    },
  },

  /* ========= タイ語 ========= */
  th: {
    home: {
      headline: site.name,
      description:
        "เราคือร้านเครป (Crêpe) เฉพาะทางในย่านฮิกาชิโยโดกาวะและคิตะของโอซาก้า เครปทุกชิ้นทำตามออร์เดอร์ อบสดใหม่ด้วยสูตรเฉพาะของเรา รับเป็น Take Away ได้ทุกสาขา และบางสาขามีพื้นที่นั่งทาน.",
    },
    stores: {
      heroTitle: `${site.name} ─ รายชื่อสาขา`,
      heroAreas: "ฮิกาชิโยโดกาวะ & คิตะ, โอซาก้า",
      heroLead: "ร้านเครปเฉพาะทาง ทำสดทุกชิ้นตามออร์เดอร์.",
      heroTail:
        "ตั้งแต่สาขาใกล้สถานีไปจนถึงร้านซ่อนตัวในย่านที่พัก — เช็คเวลาเปิดและเมนูพิเศษของแต่ละสาขาได้เลย.",
      heroIntroLine: `${site.name} คือร้านเครปเฉพาะทางในย่านฮิกาชิโยโดกาวะและคิตะของโอซาก้า.`,
    },
    areasLocal: {
      h1: "ร้านเครปในย่านฮิกาชิโยโดกาวะ, โอซาก้า",
      lead: "ลูกค้าของเรามาจากทั่วย่านฮิกาชิโยโดกาวะ เช่น Awaji, Kamishinjo, Daido-Toyosato, Itakano, Kunijima และอื่นๆ.",
      services: [
        {
          title: "เมนูยอดนิยม",
          bullets: [
            "เครปผลไม้ตามฤดูกาล (จำนวนจำกัด)",
            "คัสตาร์ด & วิปครีม (ซอสทำเอง)",
            "ช็อคโกแลตกล้วย / สตรอเบอร์รี่นม และรสคลาสสิกอื่นๆ",
          ],
        },
        {
          title: "เหมาะสำหรับ",
          bullets: [
            "Take Away & street food",
            "ของฝาก / ของขวัญเล็กๆ น้อยๆ",
            "พาครอบครัว / ของว่างหลังเลิกเรียน",
          ],
        },
      ],
      coverageTitle: "พื้นที่ครอบคลุม (ฮิกาชิโยโดกาวะ)",
      coverageBody:
        "Awaji, Higashi-Awaji, Sugahara, Toyoshin, Kamishinjo, Zuiko, Komatsu, Minami-Eguchi, Kita-Eguchi, Itakano, Odori, Osumi, Toyosato, Daido-Minami, Kunijima, Shimoshinjo และพื้นที่ใกล้เคียง.",
      faq: [
        {
          q: "สามารถสั่ง Take Away ได้ไหม?",
          a: "ได้เลย ทุกเมนูรับ Take Away ขอปรับแต่งได้ เช่น วิปครีมเพิ่มพิเศษ.",
        },
        {
          q: "มีโอกาสหมดก่อนเวลาไหม?",
          a: "เมนูตามฤดูกาลและเมนูจำกัดอาจหมดเมื่อวัตถุดิบหมด ติดตามอัปเดตล่าสุดได้ที่ Instagram ของเรา.",
        },
        {
          q: "รับชำระเงินด้วยวิธีใดบ้าง?",
          a: "รับเงินสดและการชำระเงินแบบไร้เงินสดหลักๆ สอบถามรายละเอียดได้ที่หน้าร้าน.",
        },
      ],
      contactTitle: "ติดต่อเรา",
      contactText: "ติดต่อผ่าน Instagram DM หรือสอบถามที่เคาน์เตอร์ได้เลย.",
      toProductsText: "กลับไปหน้าหลัก",
    },
  },

  /* ========= ベトナム語 ========= */
  vi: {
    home: {
      headline: site.name,
      description:
        "Chúng tôi là tiệm bánh crêpe chuyên biệt tại các quận Higashiyodogawa và Kita, Osaka. Mỗi chiếc crêpe đều được làm theo yêu cầu, nướng tươi từ công thức riêng của chúng tôi. Phục vụ mang về tại tất cả cửa hàng và có chỗ ngồi tại một số cửa hàng chọn lọc.",
    },
    stores: {
      heroTitle: `${site.name} ─ Danh sách cửa hàng`,
      heroAreas: "Higashiyodogawa & Kita, Osaka",
      heroLead: "Tiệm crêpe chuyên biệt, tất cả làm theo đặt hàng.",
      heroTail:
        "Từ cửa hàng gần ga đến những quán nhỏ ẩn mình trong khu dân cư — hãy kiểm tra giờ mở cửa và menu đặc biệt của từng cửa hàng.",
      heroIntroLine: `${site.name} là tiệm bánh crêpe chuyên biệt tại các quận Higashiyodogawa và Kita, Osaka.`,
    },
    areasLocal: {
      h1: "Tiệm bánh crêpe tại Higashiyodogawa, Osaka",
      lead: "Khách hàng của chúng tôi đến từ khắp quận Higashiyodogawa: Awaji, Kamishinjo, Daido-Toyosato, Itakano, Kunijima và nhiều nơi khác.",
      services: [
        {
          title: "Menu phổ biến",
          bullets: [
            "Crêpe trái cây theo mùa (số lượng có hạn)",
            "Kem trứng & kem tươi (sốt tự làm)",
            "Chocolate chuối / dâu sữa và các hương vị cổ điển khác",
          ],
        },
        {
          title: "Thích hợp cho",
          bullets: [
            "Mang về & ăn vặt đường phố",
            "Quà nhỏ hay đồ ăn vặt tặng bạn",
            "Du ngoạn cùng gia đình hay bữa ăn nhẹ sau giờ học",
          ],
        },
      ],
      coverageTitle: "Khu vực phục vụ (Higashiyodogawa)",
      coverageBody:
        "Awaji, Higashi-Awaji, Sugahara, Toyoshin, Kamishinjo, Zuiko, Komatsu, Minami-Eguchi, Kita-Eguchi, Itakano, Odori, Osumi, Toyosato, Daido-Minami, Kunijima, Shimoshinjo và khu vực xung quanh.",
      faq: [
        {
          q: "Có thể mua mang về không?",
          a: "Có, tất cả các sản phẩm đều có thể mang về. Đừng ngại yêu cầu tùy chỉnh như thêm kem tươi.",
        },
        {
          q: "Có khi nào hết hàng không?",
          a: "Các mặt hàng theo mùa và phiên bản giới hạn có thể hết khi nguyên liệu cạn. Theo dõi Instagram của chúng tôi để cập nhật thông tin mới nhất.",
        },
        {
          q: "Chấp nhận những hình thức thanh toán nào?",
          a: "Chúng tôi nhận tiền mặt và các phương thức thanh toán không dùng tiền mặt phổ biến. Vui lòng hỏi tại cửa hàng để biết chi tiết.",
        },
      ],
      contactTitle: "Liên hệ",
      contactText: "Liên hệ qua Instagram DM hoặc hỏi trực tiếp tại quầy.",
      toProductsText: "Quay lại trang chủ",
    },
  },

  /* ========= インドネシア語 ========= */
  id: {
    home: {
      headline: site.name,
      description:
        "Kami adalah crêperie khusus di distrik Higashiyodogawa dan Kita, Osaka. Setiap crêpe dibuat sesuai pesanan, dipanggang segar dengan resep eksklusif kami. Tersedia untuk dibawa pulang di semua gerai dan makan di tempat di beberapa gerai pilihan.",
    },
    stores: {
      heroTitle: `${site.name} ─ Daftar gerai`,
      heroAreas: "Higashiyodogawa & Kita, Osaka",
      heroLead: "Crêperie khusus, semua dibuat sesuai pesanan.",
      heroTail:
        "Dari gerai dekat stasiun hingga tempat tersembunyi di kawasan perumahan — cek jam buka dan menu eksklusif setiap gerai.",
      heroIntroLine: `${site.name} adalah crêperie khusus di distrik Higashiyodogawa dan Kita, Osaka.`,
    },
    areasLocal: {
      h1: "Crêperie di Higashiyodogawa, Osaka",
      lead: "Pelanggan kami datang dari seluruh distrik Higashiyodogawa: Awaji, Kamishinjo, Daido-Toyosato, Itakano, Kunijima dan lainnya.",
      services: [
        {
          title: "Menu favorit",
          bullets: [
            "Crêpe buah musiman (edisi terbatas)",
            "Krim custard & krim kocok (saus buatan sendiri)",
            "Cokelat pisang / susu stroberi dan rasa klasik lainnya",
          ],
        },
        {
          title: "Cocok untuk",
          bullets: [
            "Dibawa pulang & street food",
            "Oleh-oleh atau camilan kecil",
            "Jalan-jalan bersama keluarga atau camilan sepulang sekolah",
          ],
        },
      ],
      coverageTitle: "Area layanan (distrik Higashiyodogawa)",
      coverageBody:
        "Awaji, Higashi-Awaji, Sugahara, Toyoshin, Kamishinjo, Zuiko, Komatsu, Minami-Eguchi, Kita-Eguchi, Itakano, Odori, Osumi, Toyosato, Daido-Minami, Kunijima, Shimoshinjo dan sekitarnya.",
      faq: [
        {
          q: "Apakah bisa dibawa pulang?",
          a: "Ya, semua item tersedia untuk dibawa pulang. Jangan sungkan meminta opsi kustom seperti krim tambahan.",
        },
        {
          q: "Apakah ada yang bisa habis terjual?",
          a: "Item musiman dan edisi terbatas bisa habis saat bahan-bahan sudah habis. Cek Instagram kami untuk info terbaru.",
        },
        {
          q: "Metode pembayaran apa yang diterima?",
          a: "Kami menerima uang tunai dan metode pembayaran cashless utama. Tanyakan detail di gerai.",
        },
      ],
      contactTitle: "Hubungi kami",
      contactText: "Hubungi kami melalui Instagram DM atau tanyakan langsung di kasir.",
      toProductsText: "Kembali ke halaman utama",
    },
  },

  /* ========= ヒンディー語 ========= */
  hi: {
    home: {
      headline: site.name,
      description:
        "हम ओसाका के हिगाशियोदोगावा और कीता जिले में एक विशेष क्रेप (Crêpe) की दुकान हैं। हर क्रेप ऑर्डर पर बनाई जाती है, हमारी अनोखी रेसिपी से ताज़ी बेक की हुई। सभी स्टोर पर टेकअवे उपलब्ध है, और कुछ चुनिंदा स्टोर पर बैठने की सुविधा भी है।",
    },
    stores: {
      heroTitle: `${site.name} ─ हमारी दुकानें`,
      heroAreas: "हिगाशियोदोगावा और कीता, ओसाका",
      heroLead: "विशेष क्रेप की दुकान — सब कुछ ऑर्डर पर तैयार।",
      heroTail:
        "स्टेशन के पास की दुकानों से लेकर आवासीय इलाकों में छुपे हुए रत्नों तक — हर दुकान के समय और विशेष मेनू देखें।",
      heroIntroLine: `${site.name} ओसाका के हिगाशियोदोगावा और कीता जिले में एक विशेष क्रेप की दुकान है।`,
    },
    areasLocal: {
      h1: "हिगाशियोदोगावा, ओसाका में क्रेप शॉप",
      lead: "हमारे ग्राहक हिगाशियोदोगावा जिले के हर कोने से आते हैं: अवाजी, कामिशिंजो, दाइदो-तोयोसातो, इताकानो, कुनिजिमा और अन्य।",
      services: [
        {
          title: "लोकप्रिय मेनू",
          bullets: [
            "मौसमी फलों की क्रेप (सीमित)",
            "कस्टर्ड और फ्रेश क्रीम (घर का बना सॉस)",
            "चॉकलेट-बनाना / स्ट्रॉबेरी-मिल्क और अन्य क्लासिक",
          ],
        },
        {
          title: "इनके लिए आदर्श",
          bullets: [
            "टेकअवे और स्ट्रीट फूड",
            "छोटा तोहफा या मिठाई",
            "परिवार के साथ या स्कूल के बाद स्नैक",
          ],
        },
      ],
      coverageTitle: "सेवा क्षेत्र (हिगाशियोदोगावा जिला)",
      coverageBody:
        "अवाजी, हिगाशि-अवाजी, सुगावारा, तोयोशिन, कामिशिंजो, ज़ुइको, कोमात्सु, मिनामि-एगुची, कीता-एगुची, इताकानो, ओदोरी, ओसुमी, तोयोसातो, दाइदो-मिनामि, कुनिजिमा, शिमोशिंजो और आसपास के क्षेत्र।",
      faq: [
        {
          q: "क्या टेकअवे उपलब्ध है?",
          a: "हाँ, सभी आइटम टेकअवे के लिए उपलब्ध हैं। अतिरिक्त क्रीम जैसे कस्टम विकल्पों के लिए बेझिझक पूछें।",
        },
        {
          q: "क्या कभी-कभी आइटम खत्म हो जाते हैं?",
          a: "मौसमी और सीमित संस्करण के आइटम सामग्री खत्म होने पर समाप्त हो सकते हैं। नवीनतम अपडेट के लिए हमारा Instagram देखें।",
        },
        {
          q: "आप कौन से भुगतान तरीके स्वीकार करते हैं?",
          a: "हम नकद और प्रमुख कैशलेस भुगतान विधियां स्वीकार करते हैं। विवरण के लिए स्टोर पर पूछें।",
        },
      ],
      contactTitle: "संपर्क करें",
      contactText: "Instagram DM के माध्यम से या सीधे काउंटर पर पूछें।",
      toProductsText: "शीर्ष पृष्ठ पर वापस जाएं",
    },
  },

  /* ========= アラビア語 ========= */
  ar: {
    home: {
      headline: site.name,
      description:
        "نحن متجر متخصص في الكريب في حيَّي هيغاشي يودوغاوا وكيتا بمدينة أوساكا. يُحضَّر كل كريب عند الطلب، مخبوزاً طازجاً وفق وصفتنا الخاصة. الطلب للاستلام متاح في جميع المتاجر، مع أماكن جلوس في متاجر مختارة.",
    },
    stores: {
      heroTitle: `${site.name} ─ قائمة المتاجر`,
      heroAreas: "هيغاشي يودوغاوا وكيتا، أوساكا",
      heroLead: "متجر كريب متخصص — كل شيء يُحضَّر عند الطلب.",
      heroTail:
        "من المتاجر القريبة من المحطة إلى الأماكن المخفية في الأحياء السكنية — تحقق من مواعيد العمل والقوائم الحصرية لكل متجر.",
      heroIntroLine: `${site.name} هو متجر كريب متخصص في حيَّي هيغاشي يودوغاوا وكيتا بمدينة أوساكا.`,
    },
    areasLocal: {
      h1: "متجر كريب في هيغاشي يودوغاوا، أوساكا",
      lead: "يأتينا العملاء من جميع أنحاء حي هيغاشي يودوغاوا: أواجي، كامي شينجو، دايدو تويوساتو، إيتاكانو، كونيجيما وغيرها.",
      services: [
        {
          title: "القائمة الأكثر شعبية",
          bullets: [
            "كريب الفاكهة الموسمية (إصدار محدود)",
            "كريم الكاسترد والكريمة المخفوقة (صوص منزلي الصنع)",
            "الشوكولاتة والموز / الفراولة والحليب وغيرها من النكهات الكلاسيكية",
          ],
        },
        {
          title: "مثالي لـ",
          bullets: [
            "استلام الطلب والطعام الشارعي",
            "هدية صغيرة أو حلوى للمشاركة",
            "نزهة عائلية أو وجبة خفيفة بعد المدرسة",
          ],
        },
      ],
      coverageTitle: "منطقة الخدمة (حي هيغاشي يودوغاوا)",
      coverageBody:
        "أواجي، هيغاشي-أواجي، سوغاهارا، تويوشين، كامي شينجو، زويكو، كوماتسو، ميناميإغوتشي، كيتاإغوتشي، إيتاكانو، أودوري، أوسومي، تويوساتو، دايدو-ميناميا، كونيجيما، شيموشينجو والمناطق المجاورة.",
      faq: [
        {
          q: "هل يمكن الطلب للاستلام؟",
          a: "نعم، جميع المنتجات متاحة للاستلام. لا تتردد في طلب خيارات مخصصة كالمزيد من الكريمة.",
        },
        {
          q: "هل قد تنفد بعض المنتجات؟",
          a: "المنتجات الموسمية والإصدارات المحدودة قد تنفد عند انتهاء المكونات. تابع حسابنا على Instagram للحصول على آخر التحديثات.",
        },
        {
          q: "ما طرق الدفع المتاحة؟",
          a: "نقبل النقد وطرق الدفع الإلكتروني الرئيسية. استفسر في المتجر للمزيد من التفاصيل.",
        },
      ],
      contactTitle: "تواصل معنا",
      contactText: "تواصل معنا عبر Instagram DM أو اسأل مباشرة عند الكاونتر.",
      toProductsText: "العودة إلى الصفحة الرئيسية",
    },
  },
};

if (CUSTOMER.localizedContentMode === "customer-default") {
  Object.keys(copy).forEach((lang) => {
    if (lang === "ja") return;
    copy[lang] = {
      home: { ...copy.ja.home },
      stores: { ...copy.ja.stores },
      areasLocal: {
        ...copy.ja.areasLocal,
        services: copy.ja.areasLocal.services.map((service) => ({
          title: service.title,
          bullets: [...service.bullets],
        })),
        faq: copy.ja.areasLocal.faq.map((item) => ({ ...item })),
      },
    };
  });
}

/* =========================
   Footer L10N（サイト名は自動追従）
========================= */
function footerAlt(name: string) {
  return name || "Official Website";
}

/** Footer の多言語テキスト */
export const FOOTER_STRINGS: Record<string, FooterI18n> = {
  ja: {
    cta: "お問い合わせ",
    snsAria: "SNSリンク",
    instagramAlt: "Instagram",
    lineAlt: "LINE",
    siteAria: "公式サイト",
    siteAlt: site.name,
    areaLinkText: CUSTOMER.localPage.footerLinkText,
    rights: "All rights reserved.",
  },
  en: {
    cta: "Contact us",
    snsAria: "Social links",
    instagramAlt: "Instagram",
    lineAlt: "LINE",
    siteAria: "Official website",
    siteAlt: footerAlt(site.name),
    areaLinkText: "Crepe shop in Higashiyodogawa",
    rights: "All rights reserved.",
  },
  zh: {
    cta: "联系我们",
    snsAria: "社交链接",
    instagramAlt: "Instagram",
    lineAlt: "LINE",
    siteAria: "官网",
    siteAlt: site.name,
    areaLinkText: "东淀川区的可丽饼店",
    rights: "版权所有。",
  },
  "zh-TW": {
    cta: "聯絡我們",
    snsAria: "社群連結",
    instagramAlt: "Instagram",
    lineAlt: "LINE",
    siteAria: "官方網站",
    siteAlt: site.name,
    areaLinkText: "東淀川區的可麗餅店",
    rights: "版權所有。",
  },
  ko: {
    cta: "문의하기",
    snsAria: "SNS 링크",
    instagramAlt: "Instagram",
    lineAlt: "LINE",
    siteAria: "공식 사이트",
    siteAlt: site.name,
    areaLinkText: "히가시요도가와구의 크레페 가게",
    rights: "판권 소유.",
  },
  fr: {
    cta: "Nous contacter",
    snsAria: "Liens sociaux",
    instagramAlt: "Instagram",
    lineAlt: "LINE",
    siteAria: "Site officiel",
    siteAlt: site.name,
    areaLinkText: "Crêperie à Higashiyodogawa",
    rights: "Tous droits réservés.",
  },
  es: {
    cta: "Contáctanos",
    snsAria: "Enlaces sociales",
    instagramAlt: "Instagram",
    lineAlt: "LINE",
    siteAria: "Sitio oficial",
    siteAlt: site.name,
    areaLinkText: "Crêperie en Higashiyodogawa",
    rights: "Todos los derechos reservados.",
  },
  de: {
    cta: "Kontakt",
    snsAria: "Soziale Links",
    instagramAlt: "Instagram",
    lineAlt: "LINE",
    siteAria: "Offizielle Website",
    siteAlt: site.name,
    areaLinkText: "Crêperie in Higashiyodogawa",
    rights: "Alle Rechte vorbehalten.",
  },
  pt: {
    cta: "Fale conosco",
    snsAria: "Redes sociais",
    instagramAlt: "Instagram",
    lineAlt: "LINE",
    siteAria: "Site oficial",
    siteAlt: site.name,
    areaLinkText: "Crêperie em Higashiyodogawa",
    rights: "Todos os direitos reservados.",
  },
  it: {
    cta: "Contattaci",
    snsAria: "Link social",
    instagramAlt: "Instagram",
    lineAlt: "LINE",
    siteAria: "Sito ufficiale",
    siteAlt: site.name,
    areaLinkText: "Crêperie a Higashiyodogawa",
    rights: "Tutti i diritti riservati.",
  },
  ru: {
    cta: "Связаться с нами",
    snsAria: "Ссылки на соцсети",
    instagramAlt: "Instagram",
    lineAlt: "LINE",
    siteAria: "Официальный сайт",
    siteAlt: site.name,
    areaLinkText: "Крепери в Хигасийодогава",
    rights: "Все права защищены.",
  },
  th: {
    cta: "ติดต่อเรา",
    snsAria: "ลิงก์โซเชียล",
    instagramAlt: "Instagram",
    lineAlt: "LINE",
    siteAria: "เว็บไซต์ทางการ",
    siteAlt: site.name,
    areaLinkText: "ร้านเครปในย่านฮิกาชิโยโดกาวะ",
    rights: "สงวนลิขสิทธิ์",
  },
  vi: {
    cta: "Liên hệ",
    snsAria: "Liên kết mạng xã hội",
    instagramAlt: "Instagram",
    lineAlt: "LINE",
    siteAria: "Trang chính thức",
    siteAlt: site.name,
    areaLinkText: "Tiệm crêpe tại Higashiyodogawa",
    rights: "Mọi quyền được bảo lưu.",
  },
  id: {
    cta: "Hubungi kami",
    snsAria: "Tautan sosial",
    instagramAlt: "Instagram",
    lineAlt: "LINE",
    siteAria: "Situs resmi",
    siteAlt: site.name,
    areaLinkText: "Crêperie di Higashiyodogawa",
    rights: "Hak cipta dilindungi.",
  },
  hi: {
    cta: "संपर्क करें",
    snsAria: "सोशल लिंक",
    instagramAlt: "Instagram",
    lineAlt: "LINE",
    siteAria: "आधिकारिक वेबसाइट",
    siteAlt: site.name,
    areaLinkText: "हिगाशियोदोगावा में क्रेप की दुकान",
    rights: "सर्वाधिकार सुरक्षित।",
  },
  ar: {
    cta: "تواصل معنا",
    snsAria: "روابط التواصل الاجتماعي",
    instagramAlt: "إنستغرام",
    lineAlt: "لاين",
    siteAria: "الموقع الرسمي",
    siteAlt: site.name as unknown as string,
    areaLinkText: "متجر كريب في هيغاشي يودوغاوا",
    rights: "جميع الحقوق محفوظة.",
  },
};

/* =========================
   FAQ データ（ここで集約管理）
========================= */
export const faqItems: FaqItem[] = CUSTOMER.faq.map((item) => ({ ...item }));

/* =========================
   ページ辞書（ogImage は任意）
========================= */
const PAGES = {
  home: {
    path: "/",
    title: CUSTOMER.seo.homeTitle,
    description: CUSTOMER.seo.homeDescription,
    ogType: "website",
  },
  about: {
    path: "/about",
    title: `当店の思い｜${site.name}`,
    description: CUSTOMER.seo.aboutDescription,
    ogType: "website",
  },
  news: {
    path: "/news",
    title: `お知らせ｜${site.name}`,
    description: `${site.name} の最新情報・限定メニュー・営業時間などのお知らせ。`,
    ogType: "website",
  },
  areasLocal: {
    path: "/areas/local",
    title: CUSTOMER.seo.localTitle,
    description: CUSTOMER.seo.localDescription,
    ogType: "article",
  },
  products: {
    path: "/products",
    title: `メニュー一覧｜${site.name}`,
    description: CUSTOMER.seo.productsDescription,
    ogType: "website",
    ogImage: "/ogp-products.jpg",
  },
  productsEC: {
    path: "/products-ec",
    title: `メニュー一覧（オンライン）｜${site.name}`,
    description: CUSTOMER.seo.productsEcDescription,
    ogType: "website",
    ogImage: "/ogp-products.jpg",
  },
  projects: {
    path: "/projects",
    title: CUSTOMER.seo.projectsTitle,
    description: CUSTOMER.seo.projectsDescription,
    ogType: "website",
  },
  stores: {
    path: "/stores",
    title: `店舗一覧｜${site.name}`,
    description: CUSTOMER.seo.storesDescription,
    ogType: "website",
  },
  faq: {
    path: "/faq",
    title: `よくある質問（FAQ）｜${site.name}`,
    description: CUSTOMER.seo.faqDescription,
    ogType: "article",
  },
} as const;

export type PageKey = keyof typeof PAGES;
const pages: Record<PageKey, PageDef> = PAGES as unknown as Record<
  PageKey,
  PageDef
>;

/* =========================
   SEO メタデータビルダー
========================= */
export const seo = {
  base: (): Metadata => ({
    title: `${site.name}｜${site.tagline}`,
    description: site.description,
    keywords: Array.from(site.keywords),
    authors: [{ name: site.name }],
    metadataBase: METADATA_BASE_SAFE,
    alternates: { canonical: pageUrl("/") },

    verification: site.googleSiteVerification
      ? { google: site.googleSiteVerification }
      : undefined,

    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-snippet": -1,
        "max-image-preview": "large",
        "max-video-preview": -1,
      },
    },

    openGraph: {
      title: `${site.name}｜${site.tagline}`,
      description: site.description,
      url: pageUrl("/"),
      siteName: site.name,
      type: "website",
      images: [
        {
          url: pageUrl(site.logoPath),
          width: 1200,
          height: 630,
          alt: `${site.name} OGP`,
        },
      ],
      locale: "ja_JP",
    },
    twitter: {
      card: "summary_large_image",
      title: `${site.name}｜${site.tagline}`,
      description: site.description,
      images: [pageUrl(site.logoPath)],
    },
    icons: {
      icon: [
        { url: "/favicon.ico?v=4" },
        { url: "/icon.png", type: "image/png", sizes: "any" },
      ],
      apple: "/icon.png",
      shortcut: "/favicon.ico?v=4",
    },
  }),

  page: (key: PageKey, extra?: Partial<Metadata>): Metadata => {
    const p = pages[key];
    return {
      title: p.title,
      description: p.description,
      keywords: Array.from(site.keywords),
      alternates: { canonical: pageUrl(p.path) },
      openGraph: {
        title: p.title,
        description: p.description,
        url: pageUrl(p.path),
        siteName: site.name,
        images: [
          {
            url: ogImage((p as any).ogImage),
            width: 1200,
            height: 630,
            alt: site.name,
          },
        ],
        locale: "ja_JP",
        type: p.ogType,
      },
      twitter: {
        card: "summary_large_image",
        title: p.title,
        description: p.description,
        images: [ogImage((p as any).ogImage)],
      },
      ...extra,
    };
  },
};

/* =========================
   FAQ → JSON-LD 変換
========================= */
export type QA = { q: string; a: string };
export function faqToJsonLd(faq: ReadonlyArray<QA>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

/* =========================
   AI サイト設定（ブランド名/URLは site に追従）
========================= */
export const AI_SITE: AiSiteConfig = {
  brand: site.name,
  url: site.baseUrl,
  areasByLang: {
    ja: CUSTOMER.ai.areasJa,
    en: CUSTOMER.ai.areasEn,
  },
  servicesByLang: {
    ja: [...CUSTOMER.ai.servicesJa],
    en: [...CUSTOMER.ai.servicesEn],
  },
  retail: CUSTOMER.ai.retail,
  productPageRoute: CUSTOMER.ai.productPageRoute,
  languages: {
    default: "ja",
    allowed: [
      "ja",
      "en",
      "zh",
      "zh-TW",
      "ko",
      "fr",
      "es",
      "de",
      "pt",
      "it",
      "ru",
      "th",
      "vi",
      "id",
      "hi",
      "ar",
    ],
  },
  limits: {
    qaBase: 30,
    qaOwner: 40,
    qaLearned: 60,
    menuLines: 120,
    productLines: 120,
    keywords: 200,
  },
};
