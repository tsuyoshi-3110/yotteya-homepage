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

/* =========================
   URL / 環境ユーティリティ
========================= */
const ENV_BASE_URL_RAW =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const BASE_URL = ENV_BASE_URL_RAW.replace(/\/$/, "");

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
const SITE_BRAND = "お掃除処　たよって屋"; // 表示用のフル表記（全角スペース等もOK）

const SITE_OVERRIDES: SiteOverrides = {
  name: "おそうじ処 たよって屋",
  tagline: "ハウスクリーニング・家事代行（大阪・兵庫）",
  description:
    "大阪・兵庫エリア対応のハウスクリーニング・家事代行・整理収納サービス。大阪市東淀川区、豊中市、吹田市など近隣も丁寧に対応。水回り・リビング・定期清掃まで安心価格。",
  keywords: [
    "おそうじ処たよって屋",
    "たよって屋",
    "ハウスクリーニング",
    "家事代行",
    "整理収納",
    "大阪",
    "兵庫",
    "大阪市東淀川区",
    "水回り掃除",
    "エアコンクリーニング",
  ],
  tel: "+81 90-6559-9110",
  logoPath: "/images/ogpLogo.png",
  googleSiteVerification: "uN73if1NMw0L6lYoLXqKJDBt56lxDXlmbZwfurtPFNs",
  socials: {
    instagram: "https://www.instagram.com/yuki.tayotte2017",
    line: "https://lin.ee/YcKAJja",
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
  text: "大阪府豊中市小曽根3-6-13",
  postal: {
    "@type": "PostalAddress",
    addressCountry: "JP",
    addressRegion: "大阪府",
    addressLocality: "豊中市",
    streetAddress: "小曽根3-6-13",
  },
  hasMap: mapUrlFromText("大阪府豊中市小曽根3-6-13"),
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
      headline: site.name,
      description:
        "大阪府・兵庫県を中心に、ハウスクリーニング／家事代行／整理収納を提供しています。キッチン・浴室などの水回りから、リビングの徹底清掃、定期プランまで。ご家庭の状態やご要望に合わせて、無理なく続けられるプランをご提案します。",
    },
    stores: {
      heroTitle: `${site.name} ─ 店舗一覧`,
      heroAreas: "大阪府・兵庫県",
      heroLead:
        "ハウスクリーニング・家事代行・整理収納サービスを提供しています。",
      heroTail:
        "各店舗のサービス対応エリアや詳細情報をこちらからご確認いただけます。",
      heroIntroLine: `${site.name}は大阪府・兵庫県を中心にハウスクリーニング・家事代行・整理収納サービスを提供しています。`,
    },
    areasLocal: {
      h1: "東淀川区の家事代行・ハウスクリーニング",
      lead: "淡路・上新庄・だいどう豊里・井高野・柴島など東淀川区全域に対応。",
      services: [
        {
          title: "家事代行（単発／定期）",
          bullets: [
            "掃除・片付け・洗濯・買い物代行",
            "お子様／高齢者の見守り（家事の範囲内）",
            "女性スタッフ指名可",
          ],
        },
        {
          title: "ハウスクリーニング",
          bullets: [
            "水回り（キッチン・浴室・洗面・トイレ）",
            "エアコンクリーニング",
            "引越し前後・空室クリーニング",
          ],
        },
      ],
      coverageTitle: "対応エリア（東淀川区）",
      coverageBody:
        "淡路・東淡路・菅原・豊新・上新庄・瑞光・小松・南江口・北江口・井高野・大桐・大隅・豊里・大道南・柴島・下新庄 ほか",
      faq: [
        {
          q: "東淀川区で当日予約は可能ですか？",
          a: "当日の空き状況によっては対応可能です。まずはお問い合わせください。",
        },
        {
          q: "鍵預かりでの不在クリーニングは対応していますか？",
          a: "条件を確認のうえ、鍵管理のルールに基づいて対応します。詳細は事前にご相談ください。",
        },
        {
          q: "当日の追加のお願いは可能ですか？",
          a: "スケジュールに空きがあれば対応いたします。まずはお問い合わせください。",
        },
        {
          q: "鍵預かりや在宅不要の対応は？",
          a: "条件を確認のうえ、適切に管理して対応可能です。",
        },
      ],
      contactTitle: "お問い合わせ",
      contactText:
        "予約状況の確認・見積りは、LINE／メールフォームからお気軽にどうぞ。",
      toProductsText: "トップページへ",
    },
  },

  /* ========= 英語 ========= */
  en: {
    home: {
      headline: site.name,
      description:
        "We provide house cleaning, housekeeping and home-organizing services mainly in Osaka and Hyogo. From kitchens and bathrooms to living rooms and regular plans, we propose services that fit your household and needs without overburdening you.",
    },
    stores: {
      heroTitle: `${site.name} ─ Locations`,
      heroAreas: "Osaka & Hyogo",
      heroLead:
        "We offer house cleaning, housekeeping and home-organizing services.",
      heroTail:
        "Check service areas and details for each location from this page.",
      heroIntroLine: `${site.name} offers house cleaning, housekeeping and organizing services mainly across Osaka and Hyogo.`,
    },
    areasLocal: {
      h1: "Housekeeping & house cleaning in Higashiyodogawa, Osaka",
      lead: "We cover all of Higashiyodogawa Ward, including Awaji, Kamishinjo, Daido-Toyosato, Itakano, Kunijima and more.",
      services: [
        {
          title: "Housekeeping (one-off / regular)",
          bullets: [
            "Cleaning, tidying, laundry and shopping assistance",
            "Light watching over children or seniors (within housework)",
            "Female staff can be requested",
          ],
        },
        {
          title: "House cleaning",
          bullets: [
            "Wet areas (kitchen, bathroom, washstand, toilet)",
            "Air conditioner cleaning",
            "Move-in / move-out & vacant-room cleaning",
          ],
        },
      ],
      coverageTitle: "Service area (Higashiyodogawa Ward)",
      coverageBody:
        "Awaji, Higashi-Awaji, Sugahara, Toyoshin, Kamishinjo, Zuiko, Komatsu, Minami-Eguchi, Kita-Eguchi, Itakano, Otori, Osumi, Toyosato, Daido-Minami, Kunijima, Shimoshinjo and surrounding areas.",
      faq: [
        {
          q: "Can I make a same-day booking in Higashiyodogawa?",
          a: "Depending on availability that day, same-day bookings may be possible. Please contact us first.",
        },
        {
          q: "Do you accept key-keeping so you can clean while I am away?",
          a: "Yes. After confirming the conditions, we safely keep your key and clean while you are away according to our key-management rules.",
        },
        {
          q: "Can I add extra tasks on the day?",
          a: "If there is room in the schedule, we will respond as flexibly as possible. Please feel free to ask the staff.",
        },
        {
          q: "Is it possible to use the service without being at home?",
          a: "As long as we agree in advance on how to keep and manage your key, cleaning without you at home is possible.",
        },
      ],
      contactTitle: "Contact",
      contactText:
        "To check availability or request a quote, feel free to contact us via LINE or the inquiry form.",
      toProductsText: "Back to the top page",
    },
  },

  /* ========= 簡体中文 ========= */
  zh: {
    home: {
      headline: site.name,
      description:
        "本店主要在大阪府和兵库县提供家政清洁、家务代办和收纳整理服务。从厨房、浴室等水区到客厅的深度清洁，以及定期服务，根据您家庭的情况和需求提供适合、易于长期持续的方案。",
    },
    stores: {
      heroTitle: `${site.name} ─ 门店一览`,
      heroAreas: "大阪府・兵库县",
      heroLead: "提供家政清洁、家务代办、收纳整理等服务。",
      heroTail: "各门店的服务范围与详细信息请在本页面查看。",
      heroIntroLine: `${site.name} 以大阪府和兵库县为中心，提供家政清洁、家务代办与收纳整理服务。`,
    },
    areasLocal: {
      h1: "大阪市东淀川区的家政服务与家居清洁",
      lead: "覆盖淡路、上新庄、大道丰里、井高野、柴岛等东淀川区全域。",
      services: [
        {
          title: "家务代办（单次／定期）",
          bullets: [
            "打扫、整理、洗衣、代购等日常家务",
            "在家务范围内照看儿童／老人",
            "可指定女性工作人员",
          ],
        },
        {
          title: "家居清洁",
          bullets: [
            "厨房、浴室、洗手台、卫生间等水区清洁",
            "空调清洗",
            "搬家前后／空房的整体清洁",
          ],
        },
      ],
      coverageTitle: "服务范围（东淀川区）",
      coverageBody:
        "淡路、东淡路、菅原、丰新、上新庄、瑞光、小松、南江口、北江口、井高野、大桐、大隅、丰里、大道南、柴岛、下新庄等地区。",
      faq: [
        {
          q: "在东淀川区可以当天预约吗？",
          a: "视当日空档情况而定，有时可以当天安排。请先与我们联系确认。",
        },
        {
          q: "可以把钥匙交给你们，在我不在家的时候打扫吗？",
          a: "在事先确认条件并约定钥匙管理规则的前提下，可以代为保管钥匙并在您不在家时进行清洁。",
        },
        {
          q: "当天临时增加项目可以吗？",
          a: "若当日行程允许，我们会尽量灵活应对。请直接与工作人员沟通。",
        },
        {
          q: "不在家的情况下也能提供服务吗？",
          a: "只要事前就钥匙保管与管理方式达成一致，我们可以在您不在家时完成清洁。",
        },
      ],
      contactTitle: "联系我们",
      contactText:
        "如需确认预约情况或索取报价，欢迎通过 LINE 或网站表单与我们联系。",
      toProductsText: "返回首页",
    },
  },

  /* ========= 繁體中文 ========= */
  "zh-TW": {
    home: {
      headline: site.name,
      description:
        "本店主要在大阪府與兵庫縣提供居家清潔、家事代辦與收納整理服務。從廚房、浴室等濕區到客廳深度清潔，以及定期方案，我們會依照您的家庭狀況與需求，提供容易長期持續的服務計畫。",
    },
    stores: {
      heroTitle: `${site.name} ─ 店鋪一覽`,
      heroAreas: "大阪府・兵庫縣",
      heroLead: "提供居家清潔、家事代辦與收納整理服務。",
      heroTail: "各店鋪的服務範圍與詳細資訊，請在本頁面查看。",
      heroIntroLine: `${site.name} 以大阪府與兵庫縣為中心，提供居家清潔、家事代辦與收納整理服務。`,
    },
    areasLocal: {
      h1: "大阪東淀川區的家事代辦與居家清潔",
      lead: "涵蓋淡路、上新莊、大道豐里、井高野、柴島等東淀川區全區。",
      services: [
        {
          title: "家事代辦（單次／定期）",
          bullets: [
            "打掃、整理、洗衣、代購等日常家務",
            "在家事範圍內照顧小孩／長者",
            "可指名女性工作人員",
          ],
        },
        {
          title: "居家清潔",
          bullets: [
            "水區（廚房、浴室、洗手台、廁所）清潔",
            "冷氣清洗",
            "搬家前後／空屋的整體清潔",
          ],
        },
      ],
      coverageTitle: "服務範圍（東淀川區）",
      coverageBody:
        "淡路、東淡路、菅原、豐新、上新莊、瑞光、小松、南江口、北江口、井高野、大桐、大隅、豐里、大道南、柴島、下新莊等地區。",
      faq: [
        {
          q: "在東淀川區可以當天預約嗎？",
          a: "視當天空檔情況而定，有時可提供當日服務。請先與我們聯繫確認。",
        },
        {
          q: "可以把鑰匙交給你們，在我不在家時打掃嗎？",
          a: "在事前確認條件並約定鑰匙管理方式後，可以代為保管鑰匙並於您不在家時完成清潔。",
        },
        {
          q: "當天臨時追加服務可以嗎？",
          a: "若當天行程許可，我們會盡量彈性配合。請與工作人員直接溝通。",
        },
        {
          q: "人不在家也可以使用服務嗎？",
          a: "只要事前就鑰匙保管與管理方式達成共識，我們可以於您不在家時提供清潔服務。",
        },
      ],
      contactTitle: "聯絡我們",
      contactText:
        "如需確認預約情況或索取報價，歡迎透過 LINE 或網站表單與我們聯繫。",
      toProductsText: "回到首頁",
    },
  },

  /* ========= 韓国語 ========= */
  ko: {
    home: {
      headline: site.name,
      description:
        "저희는 오사카와 효고 지역을 중심으로 하우스 클리닝, 가사 대행, 정리 수납 서비스를 제공합니다. 주방과 욕실 등 물 사용이 많은 공간부터 거실 청소, 정기 플랜까지 가정의 상황과 요구에 맞춘 부담 없는 플랜을 제안합니다.",
    },
    stores: {
      heroTitle: `${site.name} ─ 지점 목록`,
      heroAreas: "오사카・효고",
      heroLead: "하우스 클리닝, 가사 대행, 정리 수납 서비스를 제공합니다.",
      heroTail:
        "각 지점의 서비스 가능 지역과 자세한 정보는 이 페이지에서 확인하실 수 있습니다.",
      heroIntroLine: `${site.name}는 오사카와 효고를 중심으로 하우스 클리닝과 가사 대행, 정리 수납 서비스를 제공하고 있습니다.`,
    },
    areasLocal: {
      h1: "오사카 히가시요도가와구의 가사 대행・하우스 클리닝",
      lead: "아와지, 가미신조, 다이도토요사토, 이타카노, 쿠니지마 등 히가시요도가와구 전역을 커버합니다.",
      services: [
        {
          title: "가사 대행 (단발 / 정기)",
          bullets: [
            "청소, 정리정돈, 세탁, 장보기 대행",
            "아이/노인 돌봄 (가사 범위 내)",
            "여성 스태프 지정 가능",
          ],
        },
        {
          title: "하우스 클리닝",
          bullets: [
            "주방, 욕실, 세면대, 화장실 등 물 사용 공간",
            "에어컨 청소",
            "이사 전후 / 공실 청소",
          ],
        },
      ],
      coverageTitle: "서비스 지역 (히가시요도가와구)",
      coverageBody:
        "아와지, 히가시아와지, 스가하라, 토요신, 가미신조, 즈이코, 코마츠, 미나미에구치, 키타에구치, 이타카노, 오오도리, 오오스미, 토요사토, 다이도미나미, 쿠니지마, 시모신조 등",
      faq: [
        {
          q: "히가시요도가와구에서 당일 예약이 가능한가요?",
          a: "당일 스케줄 상황에 따라 가능한 경우가 있습니다. 먼저 문의해 주세요.",
        },
        {
          q: "집 열쇠를 맡기고 부재 중에 청소를 맡길 수 있나요?",
          a: "조건을 확인한 뒤, 열쇠 관리 규정에 따라 안전하게 보관하고 부재 중 청소를 진행할 수 있습니다.",
        },
        {
          q: "당일에 추가로 부탁해도 되나요?",
          a: "당일 일정에 여유가 있다면 최대한 유연하게 대응해 드립니다. 스태프에게 편하게 말씀해 주세요.",
        },
        {
          q: "집에 없을 때도 서비스를 이용할 수 있나요?",
          a: "사전에 열쇠 보관 및 관리 방법에 대해 합의한 경우, 고객님이 부재 중일 때도 청소가 가능합니다.",
        },
      ],
      contactTitle: "문의하기",
      contactText:
        "예약 가능 여부 확인 및 견적 문의는 LINE 또는 문의 폼을 통해 편하게 연락해 주세요.",
      toProductsText: "맨 위 페이지로",
    },
  },

  /* ========= フランス語 ========= */
  fr: {
    home: {
      headline: site.name,
      description:
        "Nous proposons des services de ménage, d’aide à domicile et d’organisation principalement dans les préfectures d’Osaka et de Hyogo. De la cuisine et de la salle de bain au salon, ainsi que des formules régulières, nous vous proposons un service adapté à votre foyer et à vos besoins.",
    },
    stores: {
      heroTitle: `${site.name} ─ Liste des agences`,
      heroAreas: "Préfectures d’Osaka et de Hyogo",
      heroLead:
        "Nous proposons des services de ménage, d’aide à domicile et d’organisation.",
      heroTail:
        "Vous pouvez consulter ici les zones desservies et les informations détaillées de chaque agence.",
      heroIntroLine: `${site.name} propose des services de ménage, d’aide à domicile et d’organisation principalement dans les préfectures d’Osaka et de Hyogo.`,
    },
    areasLocal: {
      h1: "Aide ménagère et ménage à Higashiyodogawa (Osaka)",
      lead: "Nous intervenons dans tout l’arrondissement de Higashiyodogawa : Awaji, Kamishinjo, Daido Toyosato, Itakano, Kunijima, etc.",
      services: [
        {
          title: "Aide à domicile (ponctuelle / régulière)",
          bullets: [
            "Ménage, rangement, lessive, courses",
            "Surveillance légère des enfants ou des personnes âgées (dans le cadre des tâches ménagères)",
            "Possibilité de demander une intervenante",
          ],
        },
        {
          title: "Ménage de la maison",
          bullets: [
            "Pièces d’eau (cuisine, salle de bain, lavabo, toilettes)",
            "Nettoyage de climatiseurs",
            "Nettoyage avant/après déménagement et logements vides",
          ],
        },
      ],
      coverageTitle: "Zone d’intervention (Higashiyodogawa)",
      coverageBody:
        "Awaji, Higashi-Awaji, Sugahara, Toyoshin, Kamishinjo, Zuiko, Komatsu, Minami-Eguchi, Kita-Eguchi, Itakano, Odori, Osumi, Toyosato, Daido-Minami, Kunijima, Shimoshinjo et environs.",
      faq: [
        {
          q: "Est-il possible de réserver pour le jour même à Higashiyodogawa ?",
          a: "En fonction des disponibilités, une réservation le jour même peut être possible. Merci de nous contacter au préalable.",
        },
        {
          q: "Puis-je vous confier mes clés pour un ménage en mon absence ?",
          a: "Oui, après validation des conditions, nous gérons les clés de manière sécurisée et intervenons en votre absence.",
        },
        {
          q: "Puis-je demander des tâches supplémentaires le jour même ?",
          a: "Si le planning le permet, nous ferons notre possible pour répondre à votre demande. Merci de vous adresser à l’intervenant.",
        },
        {
          q: "Puis-je bénéficier du service sans être présent(e) au domicile ?",
          a: "Oui, si nous avons convenu à l’avance des modalités de garde et de gestion des clés.",
        },
      ],
      contactTitle: "Contact",
      contactText:
        "Pour vérifier nos disponibilités ou demander un devis, contactez-nous via LINE ou le formulaire de contact.",
      toProductsText: "Retour à la page d’accueil",
    },
  },

  /* ========= スペイン語 ========= */
  es: {
    home: {
      headline: site.name,
      description:
        "Ofrecemos servicios de limpieza del hogar, ayuda doméstica y organización principalmente en las prefecturas de Osaka y Hyogo. Desde cocina y baño hasta el salón y planes periódicos, proponemos servicios que se adaptan a su hogar y necesidades.",
    },
    stores: {
      heroTitle: `${site.name} ─ Lista de sedes`,
      heroAreas: "Osaka y Hyogo",
      heroLead:
        "Prestamos servicios de limpieza del hogar, ayuda doméstica y organización.",
      heroTail:
        "Puede consultar aquí las zonas de servicio y la información detallada de cada sede.",
      heroIntroLine: `${site.name} ofrece servicios de limpieza, ayuda doméstica y organización principalmente en Osaka y Hyogo.`,
    },
    areasLocal: {
      h1: "Ayuda doméstica y limpieza en Higashiyodogawa (Osaka)",
      lead: "Damos servicio en todo el distrito de Higashiyodogawa: Awaji, Kamishinjo, Daido Toyosato, Itakano, Kunijima y más.",
      services: [
        {
          title: "Ayuda doméstica (puntual / periódica)",
          bullets: [
            "Limpieza, orden, lavado y compras",
            "Supervisión ligera de niños o personas mayores (dentro de las tareas del hogar)",
            "Posibilidad de solicitar personal femenino",
          ],
        },
        {
          title: "Limpieza del hogar",
          bullets: [
            "Zonas de agua (cocina, baño, lavabo, aseo)",
            "Limpieza de aire acondicionado",
            "Limpieza antes/después de mudanzas y viviendas vacías",
          ],
        },
      ],
      coverageTitle: "Zona de servicio (Higashiyodogawa)",
      coverageBody:
        "Awaji, Higashi-Awaji, Sugahara, Toyoshin, Kamishinjo, Zuiko, Komatsu, Minami-Eguchi, Kita-Eguchi, Itakano, Odori, Osumi, Toyosato, Daido-Minami, Kunijima, Shimoshinjo y alrededores.",
      faq: [
        {
          q: "¿Es posible reservar para el mismo día en Higashiyodogawa?",
          a: "Dependiendo de la disponibilidad, puede ser posible. Por favor, consúltenos primero.",
        },
        {
          q: "¿Puedo dejarles mis llaves para que limpien cuando no estoy en casa?",
          a: "Sí, tras acordar las condiciones, podemos custodiar sus llaves y limpiar en su ausencia siguiendo nuestras reglas de gestión de llaves.",
        },
        {
          q: "¿Se pueden añadir tareas adicionales el mismo día?",
          a: "Si el horario lo permite, intentaremos responder con flexibilidad. Hable con el personal en el momento.",
        },
        {
          q: "¿Puedo utilizar el servicio sin estar presente en casa?",
          a: "Sí, siempre que acordemos de antemano cómo guardar y gestionar las llaves.",
        },
      ],
      contactTitle: "Contacto",
      contactText:
        "Para comprobar la disponibilidad o solicitar un presupuesto, contáctenos por LINE o mediante el formulario de la web.",
      toProductsText: "Volver a la página principal",
    },
  },

  /* ========= ドイツ語 ========= */
  de: {
    home: {
      headline: site.name,
      description:
        "Wir bieten Haushaltsreinigung, Haushaltshilfe und Organisationsservice hauptsächlich in den Präfekturen Osaka und Hyogo an. Von Küche und Bad über das Wohnzimmer bis hin zu regelmäßigen Reinigungsplänen erstellen wir ein Angebot, das zu Ihrem Haushalt und Ihren Bedürfnissen passt.",
    },
    stores: {
      heroTitle: `${site.name} ─ Standorte`,
      heroAreas: "Osaka & Hyogo",
      heroLead:
        "Wir bieten Haushaltsreinigung, Haushaltshilfe und Organisationsservice an.",
      heroTail:
        "Die Einsatzgebiete und Detailinformationen der einzelnen Standorte finden Sie auf dieser Seite.",
      heroIntroLine: `${site.name} bietet hauptsächlich in Osaka und Hyogo Haushaltsreinigung, Haushaltshilfe und Organisationsservice an.`,
    },
    areasLocal: {
      h1: "Haushaltshilfe & Reinigung in Higashiyodogawa (Osaka)",
      lead: "Wir bedienen den gesamten Bezirk Higashiyodogawa, darunter Awaji, Kamishinjo, Daido Toyosato, Itakano, Kunijima u. a.",
      services: [
        {
          title: "Haushaltshilfe (einmalig / regelmäßig)",
          bullets: [
            "Reinigung, Aufräumen, Wäsche, Einkäufe",
            "Leichte Betreuung von Kindern oder Senioren (im Rahmen der Haushaltstätigkeiten)",
            "Weibliche Mitarbeiterinnen auf Wunsch möglich",
          ],
        },
        {
          title: "Haushaltsreinigung",
          bullets: [
            "Nassbereiche (Küche, Bad, Waschbecken, WC)",
            "Klimaanlagenreinigung",
            "Reinigung vor/nach Umzügen sowie leerstehender Wohnungen",
          ],
        },
      ],
      coverageTitle: "Einsatzgebiet (Bezirk Higashiyodogawa)",
      coverageBody:
        "Awaji, Higashi-Awaji, Sugahara, Toyoshin, Kamishinjo, Zuiko, Komatsu, Minami-Eguchi, Kita-Eguchi, Itakano, Odori, Osumi, Toyosato, Daido-Minami, Kunijima, Shimoshinjo und Umgebung.",
      faq: [
        {
          q: "Ist eine Buchung am selben Tag in Higashiyodogawa möglich?",
          a: "Je nach Verfügbarkeit am jeweiligen Tag kann eine Buchung am selben Tag möglich sein. Bitte kontaktieren Sie uns vorab.",
        },
        {
          q: "Kann ich Ihnen meinen Schlüssel anvertrauen, damit Sie in meiner Abwesenheit reinigen?",
          a: "Ja, nach Abstimmung der Bedingungen bewahren wir Ihren Schlüssel sicher auf und reinigen gemäß unseren Schlüsselmanagement-Regeln.",
        },
        {
          q: "Kann ich am selben Tag zusätzliche Arbeiten beauftragen?",
          a: "Wenn der Zeitplan es erlaubt, reagieren wir so flexibel wie möglich. Sprechen Sie unsere Mitarbeiter einfach an.",
        },
        {
          q: "Kann der Service genutzt werden, wenn ich nicht zu Hause bin?",
          a: "Ja, sofern wir im Voraus die Schlüsselaufbewahrung und -verwaltung vereinbart haben.",
        },
      ],
      contactTitle: "Kontakt",
      contactText:
        "Zur Verfügbarkeitsprüfung oder Angebotsanfrage kontaktieren Sie uns gerne über LINE oder das Kontaktformular.",
      toProductsText: "Zur Startseite",
    },
  },

  /* ========= ポルトガル語 ========= */
  pt: {
    home: {
      headline: site.name,
      description:
        "Oferecemos serviços de limpeza residencial, assistência doméstica e organização principalmente nas províncias de Osaka e Hyogo. Da cozinha e do banheiro até a sala de estar, além de planos regulares, propomos serviços adequados ao seu lar e às suas necessidades.",
    },
    stores: {
      heroTitle: `${site.name} ─ Unidades`,
      heroAreas: "Osaka e Hyogo",
      heroLead:
        "Prestamos serviços de limpeza residencial, assistência doméstica e organização.",
      heroTail:
        "Você pode conferir aqui as áreas atendidas e as informações detalhadas de cada unidade.",
      heroIntroLine: `${site.name} oferece serviços de limpeza, assistência doméstica e organização principalmente em Osaka e Hyogo.`,
    },
    areasLocal: {
      h1: "Assistência doméstica e limpeza em Higashiyodogawa (Osaka)",
      lead: "Atendemos todo o bairro de Higashiyodogawa, incluindo Awaji, Kamishinjo, Daido Toyosato, Itakano, Kunijima e outros.",
      services: [
        {
          title: "Assistência doméstica (avulsa / regular)",
          bullets: [
            "Limpeza, arrumação, lavagem de roupas e compras",
            "Acompanhamento leve de crianças ou idosos (dentro das atividades domésticas)",
            "Possibilidade de solicitar funcionária do sexo feminino",
          ],
        },
        {
          title: "Limpeza residencial",
          bullets: [
            "Áreas molhadas (cozinha, banheiro, lavatório, toalete)",
            "Limpeza de ar-condicionado",
            "Limpeza antes/depois de mudança e de imóveis vazios",
          ],
        },
      ],
      coverageTitle: "Área de atendimento (Higashiyodogawa)",
      coverageBody:
        "Awaji, Higashi-Awaji, Sugahara, Toyoshin, Kamishinjo, Zuiko, Komatsu, Minami-Eguchi, Kita-Eguchi, Itakano, Odori, Osumi, Toyosato, Daido-Minami, Kunijima, Shimoshinjo e arredores.",
      faq: [
        {
          q: "É possível agendar para o mesmo dia em Higashiyodogawa?",
          a: "Dependendo da disponibilidade, pode ser possível. Entre em contato conosco primeiro.",
        },
        {
          q: "Posso deixar a chave com vocês para limparem quando eu não estiver em casa?",
          a: "Sim, depois de combinarmos as condições, podemos guardar sua chave com segurança e limpar em sua ausência, seguindo nossas regras de gestão de chaves.",
        },
        {
          q: "Posso pedir tarefas adicionais no próprio dia?",
          a: "Se o horário permitir, faremos o possível para atender. Fale diretamente com o(a) profissional.",
        },
        {
          q: "É possível usar o serviço sem estar em casa?",
          a: "Sim, desde que tenhamos combinado antecipadamente como a chave será guardada e gerida.",
        },
      ],
      contactTitle: "Fale conosco",
      contactText:
        "Para verificar disponibilidade ou solicitar orçamento, fale conosco pelo LINE ou pelo formulário do site.",
      toProductsText: "Voltar à página inicial",
    },
  },

  /* ========= イタリア語 ========= */
  it: {
    home: {
      headline: site.name,
      description:
        "Offriamo servizi di pulizia domestica, assistenza in casa e organizzazione principalmente nelle prefetture di Osaka e Hyogo. Dalla cucina e dal bagno al soggiorno, fino ai piani di pulizia periodica, proponiamo servizi adatti alla vostra casa e alle vostre esigenze.",
    },
    stores: {
      heroTitle: `${site.name} ─ Elenco sedi`,
      heroAreas: "Osaka e Hyogo",
      heroLead:
        "Forniamo servizi di pulizia domestica, assistenza e organizzazione.",
      heroTail:
        "In questa pagina potete verificare le aree di servizio e le informazioni dettagliate di ogni sede.",
      heroIntroLine: `${site.name} offre servizi di pulizia, assistenza domestica e organizzazione principalmente nelle prefetture di Osaka e Hyogo.`,
    },
    areasLocal: {
      h1: "Assistenza domestica e pulizie a Higashiyodogawa (Osaka)",
      lead: "Serviamo l’intero distretto di Higashiyodogawa: Awaji, Kamishinjo, Daido Toyosato, Itakano, Kunijima e altre zone.",
      services: [
        {
          title: "Assistenza domestica (singola / periodica)",
          bullets: [
            "Pulizia, riordino, bucato, spesa",
            "Sorveglianza leggera di bambini o anziani (nell’ambito delle faccende domestiche)",
            "Possibilità di richiedere personale femminile",
          ],
        },
        {
          title: "Pulizia della casa",
          bullets: [
            "Zone umide (cucina, bagno, lavabo, WC)",
            "Pulizia dei climatizzatori",
            "Pulizie prima/dopo il trasloco e di abitazioni vuote",
          ],
        },
      ],
      coverageTitle: "Zona di servizio (Higashiyodogawa)",
      coverageBody:
        "Awaji, Higashi-Awaji, Sugahara, Toyoshin, Kamishinjo, Zuiko, Komatsu, Minami-Eguchi, Kita-Eguchi, Itakano, Odori, Osumi, Toyosato, Daido-Minami, Kunijima, Shimoshinjo e dintorni.",
      faq: [
        {
          q: "È possibile una prenotazione nello stesso giorno a Higashiyodogawa?",
          a: "A seconda della disponibilità, può essere possibile. Contattateci prima per confermare.",
        },
        {
          q: "Posso affidarvi le chiavi per effettuare le pulizie in mia assenza?",
          a: "Sì, dopo aver concordato le condizioni, possiamo custodire le chiavi in sicurezza e pulire secondo le nostre regole di gestione delle chiavi.",
        },
        {
          q: "Posso richiedere lavori aggiuntivi il giorno stesso?",
          a: "Se il programma lo consente, cercheremo di essere il più flessibili possibile. Parlatene direttamente con il nostro personale.",
        },
        {
          q: "È possibile utilizzare il servizio senza essere presenti in casa?",
          a: "Sì, purché si sia concordato in anticipo come conservare e gestire le chiavi.",
        },
      ],
      contactTitle: "Contattaci",
      contactText:
        "Per verificare la disponibilità o richiedere un preventivo, contattaci tramite LINE o tramite il modulo sul sito.",
      toProductsText: "Torna alla pagina iniziale",
    },
  },

  /* ========= ロシア語 ========= */
  ru: {
    home: {
      headline: site.name,
      description:
        "Мы предлагаем услуги по уборке домов, помощь по хозяйству и организацию пространства в основном в префектурах Осака и Хёго. От кухни и ванной до гостиной и регулярных планов уборки — мы подбираем сервис, который подходит именно вашей семье и вашим потребностям.",
    },
    stores: {
      heroTitle: `${site.name} ─ Список филиалов`,
      heroAreas: "Префектуры Осака и Хёго",
      heroLead:
        "Мы предоставляем услуги по уборке дома, помощь по хозяйству и организацию пространства.",
      heroTail:
        "Здесь вы можете узнать зоны обслуживания и подробную информацию по каждому филиалу.",
      heroIntroLine: `${site.name} оказывает услуги по уборке, помощи по хозяйству и организации пространства в основном в префектурах Осака и Хёго.`,
    },
    areasLocal: {
      h1: "Помощь по дому и уборка в районе Хигасийодогава (Осака)",
      lead: "Мы работаем по всему району Хигасийодогава: Авадзи, Камисиндзё, Дайдо Тойосато, Итакано, Кунидзима и т. д.",
      services: [
        {
          title: "Помощь по хозяйству (разовая / регулярная)",
          bullets: [
            "Уборка, наведение порядка, стирка, покупки",
            "Лёгкий присмотр за детьми или пожилыми (в рамках домашних дел)",
            "Возможность запросить сотрудницу-женщину",
          ],
        },
        {
          title: "Уборка дома",
          bullets: [
            "Влажные зоны (кухня, ванная, умывальник, туалет)",
            "Чистка кондиционеров",
            "Уборка до/после переезда и уборка пустующих квартир",
          ],
        },
      ],
      coverageTitle: "Зона обслуживания (район Хигасийодогава)",
      coverageBody:
        "Авадзи, Хигаси-Авадзи, Сугавара, Тоёсин, Камисиндзё, Дзуйко, Комацу, Минами-Эгути, Кита-Эгути, Итакано, Одори, Осуми, Тоёсато, Дайдо-Минами, Кунидзима, Симосиндзё и окрестности.",
      faq: [
        {
          q: "Можно ли оформить заказ в районе Хигасийодогава в тот же день?",
          a: "В зависимости от загруженности это возможно. Пожалуйста, сначала свяжитесь с нами для уточнения.",
        },
        {
          q: "Могу ли я передать вам ключи, чтобы вы убрали квартиру в моё отсутствие?",
          a: "Да, после согласования условий мы безопасно храним ключи и проводим уборку согласно нашим правилам управления ключами.",
        },
        {
          q: "Можно ли в день уборки добавить дополнительные работы?",
          a: "Если позволяет расписание, мы постараемся пойти навстречу. Обсудите это с нашим сотрудником.",
        },
        {
          q: "Можно ли воспользоваться услугами, если меня не будет дома?",
          a: "Да, при условии, что мы заранее договорились о порядке хранения и использования ключей.",
        },
      ],
      contactTitle: "Связаться с нами",
      contactText:
        "Чтобы узнать о доступности или запросить стоимость услуг, свяжитесь с нами через LINE или форму на сайте.",
      toProductsText: "Вернуться на главную страницу",
    },
  },

  /* ========= タイ語 ========= */
  th: {
    home: {
      headline: site.name,
      description:
        "เราให้บริการทำความสะอาดบ้าน แม่บ้าน และจัดระเบียบบ้านเป็นหลักในจังหวัดโอซาก้าและเฮียวโกะ ตั้งแต่ห้องครัว ห้องน้ำ ไปจนถึงห้องนั่งเล่น รวมถึงแพ็กเกจทำความสะอาดแบบรายครั้งและรายเดือนที่เหมาะกับบ้านและความต้องการของคุณ.",
    },
    stores: {
      heroTitle: `${site.name} ─ รายชื่อสาขา`,
      heroAreas: "โอซาก้าและเฮียวโกะ",
      heroLead: "ให้บริการทำความสะอาดบ้าน แม่บ้านช่วยงาน และจัดระเบียบบ้าน.",
      heroTail:
        "คุณสามารถตรวจสอบพื้นที่ให้บริการและรายละเอียดของแต่ละสาขาได้จากหน้านี้.",
      heroIntroLine: `${site.name} ให้บริการทำความสะอาดบ้าน แม่บ้าน และจัดระเบียบบ้านในพื้นที่โอซาก้าและเฮียวโกะ.`,
    },
    areasLocal: {
      h1: "แม่บ้านและทำความสะอาดในเขตฮิกาชิโยโดกาวะ (โอซาก้า)",
      lead: "ให้บริการครอบคลุมทั้งเขตฮิกาชิโยโดกาวะ เช่น Awaji, Kamishinjo, Daido Toyosato, Itakano, Kunijima เป็นต้น",
      services: [
        {
          title: "แม่บ้านช่วยงาน (รายครั้ง / รายเดือน)",
          bullets: [
            "ทำความสะอาด จัดของ ซักผ้า ซื้อของเข้าบ้าน",
            "ช่วยดูแลเด็กและผู้สูงอายุในขอบเขตงานบ้าน",
            "สามารถขอให้จัดส่งพนักงานผู้หญิงได้",
          ],
        },
        {
          title: "ทำความสะอาดบ้าน",
          bullets: [
            "บริเวณที่เปียกน้ำ เช่น ห้องครัว ห้องน้ำ อ่างล้างหน้า ห้องสุขา",
            "ทำความสะอาดเครื่องปรับอากาศ",
            "ทำความสะอาดบ้านก่อน/หลังย้าย และห้องว่าง",
          ],
        },
      ],
      coverageTitle: "พื้นที่ให้บริการ (เขตฮิกาชิโยโดกาวะ)",
      coverageBody:
        "Awaji, Higashi-Awaji, Sugahara, Toyoshin, Kamishinjo, Zuiko, Komatsu, Minami-Eguchi, Kita-Eguchi, Itakano, Odori, Osumi, Toyosato, Daido-Minami, Kunijima, Shimoshinjo และพื้นที่ใกล้เคียง",
      faq: [
        {
          q: "สามารถจองงานวันเดียวกันในเขตฮิกาชิโยโดกาวะได้ไหม?",
          a: "ขึ้นอยู่กับตารางงานในวันนั้น หากมีช่องว่างอาจทำได้ กรุณาติดต่อสอบถามก่อน.",
        },
        {
          q: "สามารถฝากกุญแจบ้านให้ไปทำความสะอาดตอนที่ไม่อยู่บ้านได้ไหม?",
          a: "ได้ เมื่อได้ตกลงเงื่อนไขและวิธีการเก็บรักษากุญแจล่วงหน้า เราจะเก็บกุญแจอย่างปลอดภัยและเข้าไปทำความสะอาดตามกติกา.",
        },
        {
          q: "สามารถขอเพิ่มงานในวันทำความสะอาดได้ไหม?",
          a: "ถ้าตารางเวลาว่างเพียงพอ เราจะพยายามช่วยให้ได้มากที่สุด กรุณาคุยกับพนักงานหน้างาน.",
        },
        {
          q: "ใช้บริการได้ไหมถ้าไม่มีคนอยู่บ้าน?",
          a: "ได้ หากได้ตกลงวิธีการเก็บและจัดการกุญแจล่วงหน้าแล้ว.",
        },
      ],
      contactTitle: "ติดต่อเรา",
      contactText:
        "หากต้องการตรวจสอบตารางว่างหรือขอใบเสนอราคา สามารถติดต่อผ่าน LINE หรือแบบฟอร์มบนเว็บไซต์ได้.",
      toProductsText: "กลับไปหน้าหลัก",
    },
  },

  /* ========= ベトナム語 ========= */
  vi: {
    home: {
      headline: site.name,
      description:
        "Chúng tôi cung cấp dịch vụ vệ sinh nhà ở, giúp việc gia đình và sắp xếp nhà cửa chủ yếu tại Osaka và Hyogo. Từ nhà bếp, phòng tắm đến phòng khách và các gói vệ sinh định kỳ, chúng tôi đề xuất dịch vụ phù hợp với gia đình và nhu cầu của bạn.",
    },
    stores: {
      heroTitle: `${site.name} ─ Danh sách cơ sở`,
      heroAreas: "Osaka & Hyogo",
      heroLead:
        "Cung cấp dịch vụ vệ sinh nhà ở, giúp việc gia đình và sắp xếp không gian.",
      heroTail:
        "Bạn có thể xem khu vực phục vụ và thông tin chi tiết của từng cơ sở tại đây.",
      heroIntroLine: `${site.name} cung cấp dịch vụ vệ sinh, giúp việc gia đình và sắp xếp nhà cửa chủ yếu tại Osaka và Hyogo.`,
    },
    areasLocal: {
      h1: "Giúp việc gia đình và vệ sinh nhà ở tại quận Higashiyodogawa (Osaka)",
      lead: "Phục vụ toàn bộ quận Higashiyodogawa, bao gồm Awaji, Kamishinjo, Daido Toyosato, Itakano, Kunijima, v.v.",
      services: [
        {
          title: "Giúp việc gia đình (lẻ / định kỳ)",
          bullets: [
            "Dọn dẹp, sắp xếp, giặt giũ, đi chợ",
            "Trông chừng trẻ em hoặc người cao tuổi ở mức độ nhẹ (trong phạm vi công việc nhà)",
            "Có thể yêu cầu nhân viên nữ",
          ],
        },
        {
          title: "Vệ sinh nhà ở",
          bullets: [
            "Khu vực ướt (bếp, phòng tắm, bồn rửa, nhà vệ sinh)",
            "Vệ sinh điều hòa",
            "Vệ sinh nhà trước/sau khi chuyển và nhà trống",
          ],
        },
      ],
      coverageTitle: "Khu vực phục vụ (quận Higashiyodogawa)",
      coverageBody:
        "Awaji, Higashi-Awaji, Sugahara, Toyoshin, Kamishinjo, Zuiko, Komatsu, Minami-Eguchi, Kita-Eguchi, Itakano, Odori, Osumi, Toyosato, Daido-Minami, Kunijima, Shimoshinjo và khu vực xung quanh.",
      faq: [
        {
          q: "Có thể đặt dịch vụ trong ngày tại quận Higashiyodogawa không?",
          a: "Tùy theo lịch làm việc ngày hôm đó, đôi khi có thể. Vui lòng liên hệ trước để kiểm tra.",
        },
        {
          q: "Tôi có thể giao chìa khóa để các bạn dọn nhà khi tôi vắng nhà không?",
          a: "Được, sau khi thống nhất điều kiện, chúng tôi sẽ giữ chìa khóa an toàn và dọn dẹp theo quy định quản lý chìa khóa.",
        },
        {
          q: "Có thể yêu cầu thêm công việc ngay trong ngày không?",
          a: "Nếu lịch làm việc cho phép, chúng tôi sẽ cố gắng hỗ trợ linh hoạt. Hãy trao đổi trực tiếp với nhân viên.",
        },
        {
          q: "Tôi có thể sử dụng dịch vụ khi không có nhà không?",
          a: "Có, miễn là chúng ta đã thỏa thuận trước về cách giữ và quản lý chìa khóa.",
        },
      ],
      contactTitle: "Liên hệ",
      contactText:
        "Để kiểm tra lịch trống hoặc yêu cầu báo giá, hãy liên hệ qua LINE hoặc mẫu liên hệ trên website.",
      toProductsText: "Quay lại trang chủ",
    },
  },

  /* ========= インドネシア語 ========= */
  id: {
    home: {
      headline: site.name,
      description:
        "Kami menyediakan layanan pembersihan rumah, bantuan pekerjaan rumah tangga, dan penataan rumah terutama di wilayah Osaka dan Hyogo. Dari dapur dan kamar mandi hingga ruang keluarga serta paket pembersihan berkala, kami menawarkan layanan yang sesuai dengan kondisi dan kebutuhan rumah Anda.",
    },
    stores: {
      heroTitle: `${site.name} ─ Daftar cabang`,
      heroAreas: "Osaka & Hyogo",
      heroLead:
        "Menyediakan layanan pembersihan rumah, bantuan rumah tangga, dan penataan rumah.",
      heroTail:
        "Anda dapat melihat area layanan dan informasi detail setiap cabang di halaman ini.",
      heroIntroLine: `${site.name} menawarkan layanan pembersihan rumah, bantuan rumah tangga, dan penataan rumah terutama di wilayah Osaka dan Hyogo.`,
    },
    areasLocal: {
      h1: "Bantuan rumah tangga & pembersihan di Higashiyodogawa (Osaka)",
      lead: "Kami melayani seluruh distrik Higashiyodogawa, termasuk Awaji, Kamishinjo, Daido Toyosato, Itakano, Kunijima, dan sekitarnya.",
      services: [
        {
          title: "Bantuan rumah tangga (sekali / rutin)",
          bullets: [
            "Membersihkan, merapikan, mencuci, dan belanja kebutuhan",
            "Mengawasi anak atau lansia secara ringan (dalam lingkup pekerjaan rumah)",
            "Dapat meminta petugas perempuan",
          ],
        },
        {
          title: "Pembersihan rumah",
          bullets: [
            "Area basah (dapur, kamar mandi, wastafel, toilet)",
            "Pembersihan AC",
            "Pembersihan rumah sebelum/sesudah pindahan dan rumah kosong",
          ],
        },
      ],
      coverageTitle: "Area layanan (distrik Higashiyodogawa)",
      coverageBody:
        "Awaji, Higashi-Awaji, Sugahara, Toyoshin, Kamishinjo, Zuiko, Komatsu, Minami-Eguchi, Kita-Eguchi, Itakano, Odori, Osumi, Toyosato, Daido-Minami, Kunijima, Shimoshinjo dan sekitarnya.",
      faq: [
        {
          q: "Apakah bisa memesan layanan di hari yang sama di Higashiyodogawa?",
          a: "Tergantung ketersediaan di hari tersebut, kadang-kadang bisa. Silakan hubungi kami terlebih dahulu.",
        },
        {
          q: "Bisakah saya menitipkan kunci rumah agar kalian membersihkan saat saya tidak di rumah?",
          a: "Bisa. Setelah menyepakati syaratnya, kami akan menyimpan kunci dengan aman dan membersihkan sesuai aturan pengelolaan kunci kami.",
        },
        {
          q: "Bisakah menambah pekerjaan tambahan di hari yang sama?",
          a: "Jika jadwal memungkinkan, kami akan berusaha memberikan respon yang fleksibel. Silakan bicarakan langsung dengan petugas.",
        },
        {
          q: "Apakah bisa menggunakan layanan jika saya tidak berada di rumah?",
          a: "Bisa, selama sebelumnya sudah disepakati cara penyimpanan dan pengelolaan kunci.",
        },
      ],
      contactTitle: "Hubungi kami",
      contactText:
        "Untuk mengecek ketersediaan jadwal atau meminta penawaran harga, hubungi kami melalui LINE atau formulir di situs.",
      toProductsText: "Kembali ke halaman utama",
    },
  },

  /* ========= ヒンディー語 ========= */
  hi: {
    home: {
      headline: site.name,
      description:
        "हम मुख्य रूप से ओसाका और ह्योगो क्षेत्र में हाउस क्लीनिंग, होम हेल्प और व्यवस्थित करने की सेवा प्रदान करते हैं। किचन और बाथरूम से लेकर लिविंग रूम और नियमित क्लीनिंग प्लान तक, हम आपके घर और जरूरतों के अनुसार सेवा सुझाते हैं।",
    },
    stores: {
      heroTitle: `${site.name} ─ शाखाओं की सूची`,
      heroAreas: "ओसाका और ह्योगो",
      heroLead:
        "हम हाउस क्लीनिंग, होम हेल्प और घर व्यवस्थित करने की सेवाएँ प्रदान करते हैं।",
      heroTail:
        "प्रत्येक शाखा के सेवा क्षेत्र और विस्तृत जानकारी आप इस पेज पर देख सकते हैं।",
      heroIntroLine: `${site.name} मुख्य रूप से ओसाका और ह्योगो क्षेत्र में हाउस क्लीनिंग, होम हेल्प और व्यवस्थित करने की सेवाएँ प्रदान करता है।`,
    },
    areasLocal: {
      h1: "हिगाशी-योदोगावा (ओसाका) में होम हेल्प और हाउस क्लीनिंग",
      lead: "हम हिगाशी-योदोगावा वार्ड के पूरे क्षेत्र में सेवा देते हैं, जैसे Awaji, Kamishinjo, Daido Toyosato, Itakano, Kunijima आदि।",
      services: [
        {
          title: "होम हेल्प (एक बार / नियमित)",
          bullets: [
            "सफाई, सामान व्यवस्थित करना, कपड़े धोना, खरीदारी में मदद",
            "बच्चों या बुजुर्गों की हल्की देखभाल (घर के काम की सीमा में)",
            "महिला स्टाफ की मांग की जा सकती है",
          ],
        },
        {
          title: "हाउस क्लीनिंग",
          bullets: [
            "वेट एरिया (किचन, बाथरूम, वॉशबेसिन, टॉयलेट)",
            "एयर कंडीशनर की सफाई",
            "शिफ्टिंग से पहले/बाद और खाली घरों की सफाई",
          ],
        },
      ],
      coverageTitle: "सेवा क्षेत्र (हिगाशी-योदोगावा वार्ड)",
      coverageBody:
        "Awaji, Higashi-Awaji, Sugahara, Toyoshin, Kamishinjo, Zuiko, Komatsu, Minami-Eguchi, Kita-Eguchi, Itakano, Odori, Osumi, Toyosato, Daido-Minami, Kunijima, Shimoshinjo और आस-पास के क्षेत्र।",
      faq: [
        {
          q: "क्या हिगाशी-योदोगावा में उसी दिन बुकिंग संभव है?",
          a: "उस दिन की उपलब्धता पर निर्भर करता है। कभी-कभी संभव है, कृपया पहले हमसे संपर्क करें।",
        },
        {
          q: "क्या मैं घर की चाबी आपको दे सकता/सकती हूँ ताकि आप मेरी गैर-मौजूदगी में सफाई कर सकें?",
          a: "हाँ, शर्तों पर सहमति के बाद हम आपकी चाबी सुरक्षित रूप से रखते हैं और अपने की-मैनेजमेंट नियमों के अनुसार सफाई करते हैं।",
        },
        {
          q: "क्या उसी दिन अतिरिक्त काम की रिक्वेस्ट कर सकते हैं?",
          a: "यदि शेड्यूल में समय हो तो हम यथासंभव लचीला व्यवहार करते हैं। कृपया स्टाफ से सीधे बात करें।",
        },
        {
          q: "क्या मेरी गैर-मौजूदगी में भी सेवा ली जा सकती है?",
          a: "हाँ, यदि पहले से चाबी रखने और मैनेज करने के तरीके पर सहमति हो जाए तो।",
        },
      ],
      contactTitle: "संपर्क करें",
      contactText:
        "उपलब्धता जाँचने या अनुमान (कोट) के लिए, कृपया LINE या वेबसाइट के संपर्क फॉर्म के माध्यम से हमसे जुड़ें।",
      toProductsText: "टॉप पेज पर लौटें",
    },
  },

  /* ========= アラビア語 ========= */
  ar: {
    home: {
      headline: site.name,
      description:
        "نقدّم خدمات تنظيف المنازل، والمساعدة المنزلية، وتنظيم البيت بشكل أساسي في محافظتي أوساكا و هيوغو. من المطبخ والحمّام إلى غرفة المعيشة، إضافة إلى خطط تنظيف دورية، نوفّر خدمة تناسب منزلك واحتياجاتك.",
    },
    stores: {
      heroTitle: `${site.name} ─ قائمة الفروع`,
      heroAreas: "أوساكا و هيوغو",
      heroLead:
        "نقدّم خدمات تنظيف المنازل، والمساعدة المنزلية، وتنظيم المساحات.",
      heroTail:
        "يمكنك الاطّلاع على مناطق الخدمة والمعلومات التفصيلية لكل فرع من خلال هذه الصفحة.",
      heroIntroLine: `${site.name} يقدّم خدمات التنظيف والمساعدة المنزلية وتنظيم البيت بشكل رئيسي في محافظتي أوساكا و هيوغو.`,
    },
    areasLocal: {
      h1: "مساعدة منزلية وتنظيف في حي هيغاشي يودوغاوا (أوساكا)",
      lead: "نغطي جميع أنحاء حي هيغاشي يودوغاوا، بما في ذلك Awaji و Kamishinjo و Daido Toyosato و Itakano و Kunijima وغيرها.",
      services: [
        {
          title: "مساعدة منزلية (مرة واحدة / دورية)",
          bullets: [
            "تنظيف، ترتيب، غسيل، ومساعدة في التسوق",
            "مراقبة خفيفة للأطفال أو كبار السن (في نطاق الأعمال المنزلية)",
            "إمكانية طلب عاملة منزلية (أنثى)",
          ],
        },
        {
          title: "تنظيف المنزل",
          bullets: [
            "المناطق الرطبة (المطبخ، الحمّام، حوض الغسيل، دورة المياه)",
            "تنظيف أجهزة التكييف",
            "تنظيف المنازل قبل/بعد الانتقال والمنازل الخالية",
          ],
        },
      ],
      coverageTitle: "منطقة الخدمة (حي هيغاشي يودوغاوا)",
      coverageBody:
        "Awaji و Higashi-Awaji و Sugahara و Toyoshin و Kamishinjo و Zuiko و Komatsu و Minami-Eguchi و Kita-Eguchi و Itakano و Odori و Osumi و Toyosato و Daido-Minami و Kunijima و Shimoshinjo والمناطق المجاورة.",
      faq: [
        {
          q: "هل يمكن الحجز في نفس اليوم في حي هيغاشي يودوغاوا؟",
          a: "يعتمد ذلك على مدى توفّر الوقت في ذلك اليوم، وقد يكون ممكنًا أحيانًا. يُرجى التواصل معنا أولًا للتأكّد.",
        },
        {
          q: "هل يمكنني تسليمكم مفتاح المنزل لتنظيفه أثناء غيابي؟",
          a: "نعم، بعد الاتفاق على الشروط، نقوم بحفظ المفتاح بأمان ونلتزم بقواعد إدارة المفاتيح الخاصة بنا أثناء التنظيف.",
        },
        {
          q: "هل يمكن طلب أعمال إضافية في نفس اليوم؟",
          a: "إذا سمح الجدول الزمني، سنحاول الاستجابة بشكل مرن قدر الإمكان. يُرجى التحدّث مباشرة مع الموظف.",
        },
        {
          q: "هل يمكن الاستفادة من الخدمة دون وجودي في المنزل؟",
          a: "نعم، طالما تم الاتفاق مسبقًا على طريقة حفظ وإدارة المفتاح.",
        },
      ],
      contactTitle: "اتصل بنا",
      contactText:
        "للاستفسار عن المواعيد المتاحة أو طلب عرض سعر، يُرجى التواصل معنا عبر LINE أو نموذج الاتصال على الموقع.",
      toProductsText: "العودة إلى الصفحة الرئيسية",
    },
  },
};

/* =========================
   Footer L10N（サイト名は自動追従）
========================= */
function footerAlt(name: string) {
  return name || "Official Website";
}

/** Footer の多言語テキスト */
export const FOOTER_STRINGS: Record<string, FooterI18n> = {
  ja: {
    cta: "無料相談・お問い合わせ",
    snsAria: "SNSリンク",
    instagramAlt: "Instagram",
    lineAlt: "LINE",
    siteAria: "公式サイト",
    siteAlt: site.name,
    areaLinkText: "東淀川区の家事代行・ハウスクリーニング",
    rights: "All rights reserved.",
  },
  en: {
    cta: "Contact us",
    snsAria: "Social links",
    instagramAlt: "Instagram",
    lineAlt: "LINE",
    siteAria: "Official website",
    siteAlt: footerAlt(site.name),
    areaLinkText: "Housekeeping & house cleaning in local",
    rights: "All rights reserved.",
  },
  zh: {
    cta: "免费咨询・联系",
    snsAria: "社交链接",
    instagramAlt: "Instagram",
    lineAlt: "LINE",
    siteAria: "官网",
    siteAlt: `Tayotteya 官方网站`,
    areaLinkText: "东淀川区的家政与家居清洁",
    rights: "版权所有。",
  },
  "zh-TW": {
    cta: "免費諮詢・聯絡我們",
    snsAria: "社群連結",
    instagramAlt: "Instagram",
    lineAlt: "LINE",
    siteAria: "官方網站",
    siteAlt: `Tayotteya 官方網站`,
    areaLinkText: "東淀川區的家事服務・居家清潔",
    rights: "版權所有。",
  },
  ko: {
    cta: "문의하기",
    snsAria: "SNS 링크",
    instagramAlt: "Instagram",
    lineAlt: "LINE",
    siteAria: "공식 사이트",
    siteAlt: `Tayotteya 공식`,
    areaLinkText: "히가시요도가와구 가사도우미·하우스 클리닝",
    rights: "판권 소유.",
  },
  fr: {
    cta: "Nous contacter",
    snsAria: "Liens sociaux",
    instagramAlt: "Instagram",
    lineAlt: "LINE",
    siteAria: "Site officiel",
    siteAlt: `Tayotteya (Officiel)`,
    areaLinkText: "Ménage & nettoyage domestique à local",
    rights: "Tous droits réservés.",
  },
  es: {
    cta: "Contáctanos",
    snsAria: "Enlaces sociales",
    instagramAlt: "Instagram",
    lineAlt: "LINE",
    siteAria: "Sitio oficial",
    siteAlt: `Tayotteya (Oficial)`,
    areaLinkText: "Servicio doméstico y limpieza en local",
    rights: "Todos los derechos reservados.",
  },
  de: {
    cta: "Kontakt",
    snsAria: "Soziale Links",
    instagramAlt: "Instagram",
    lineAlt: "LINE",
    siteAria: "Offizielle Website",
    siteAlt: `Tayotteya (Offiziell)`,
    areaLinkText: "Haushaltshilfe & Hausreinigung in local",
    rights: "Alle Rechte vorbehalten.",
  },
  pt: {
    cta: "Fale conosco",
    snsAria: "Redes sociais",
    instagramAlt: "Instagram",
    lineAlt: "LINE",
    siteAria: "Site oficial",
    siteAlt: `Tayotteya (Oficial)`,
    areaLinkText: "Serviços domésticos e limpeza em local",
    rights: "Todos os direitos reservados.",
  },
  it: {
    cta: "Contattaci",
    snsAria: "Link social",
    instagramAlt: "Instagram",
    lineAlt: "LINE",
    siteAria: "Sito ufficiale",
    siteAlt: `Tayotteya (Ufficiale)`,
    areaLinkText: "Servizi domestici e pulizie a local",
    rights: "Tutti i diritti riservati.",
  },
  ru: {
    cta: "Связаться с нами",
    snsAria: "Ссылки на соцсети",
    instagramAlt: "Instagram",
    lineAlt: "LINE",
    siteAria: "Официальный сайт",
    siteAlt: `Tayotteya (Официальный)`,
    areaLinkText: "Бытовые услуги и уборка в районе Хигасийодогава",
    rights: "Все права защищены.",
  },
  th: {
    cta: "ติดต่อเรา",
    snsAria: "ลิงก์โซเชียล",
    instagramAlt: "Instagram",
    lineAlt: "LINE",
    siteAria: "เว็บไซต์ทางการ",
    siteAlt: `Tayotteya (ทางการ)`,
    areaLinkText: "แม่บ้านและทำความสะอาดในเขตฮิกาชิโยโดกาวะ",
    rights: "สงวนลิขสิทธิ์",
  },
  vi: {
    cta: "Liên hệ",
    snsAria: "Liên kết mạng xã hội",
    instagramAlt: "Instagram",
    lineAlt: "LINE",
    siteAria: "Trang chính thức",
    siteAlt: `Tayotteya (Chính thức)`,
    areaLinkText: "Dọn dẹp & giúp việc nhà tại local",
    rights: "Mọi quyền được bảo lưu.",
  },
  id: {
    cta: "Hubungi kami",
    snsAria: "Tautan sosial",
    instagramAlt: "Instagram",
    lineAlt: "LINE",
    siteAria: "Situs resmi",
    siteAlt: `Tayotteya (Resmi)`,
    areaLinkText: "Jasa bersih-bersih & asisten rumah tangga di local",
    rights: "Hak cipta dilindungi.",
  },
  hi: {
    cta: "संपर्क करें",
    snsAria: "सोशल लिंक",
    instagramAlt: "Instagram",
    lineAlt: "LINE",
    siteAria: "आधिकारिक वेबसाइट",
    siteAlt: `Tayotteya (आधिकारिक)`,
    areaLinkText: "हिगाशी-योदोगावा में हाउसकीपिंग व हाउस क्लीनिंग",
    rights: "सर्वाधिकार सुरक्षित।",
  },
  ar: {
    cta: "اتصل بنا",
    snsAria: "روابط التواصل الاجتماعي",
    instagramAlt: "إنستغرام",
    lineAlt: "لاين",
    siteAria: "الموقع الرسمي",
    siteAlt: `تايوتيّا (رسمي)` as unknown as string,
    areaLinkText: "خدمات التدبير المنزلي وتنظيف المنازل في هيغاشي يودوغاوا",
    rights: "جميع الحقوق محفوظة.",
  },
};

/* =========================
   FAQ データ（ここで集約管理）
========================= */
export const faqItems: FaqItem[] = [
  {
    question: "対応エリアはどこですか？",
    answer:
      "大阪府・兵庫県を中心に対応しています。豊中市・吹田市・東淀川区・池田市・箕面市・尼崎市など、まずはお気軽にご相談ください。",
  },
  {
    question: "見積もりは無料ですか？",
    answer:
      "はい、無料です。現地確認が必要な場合もありますが、費用はいただきません。",
  },
  {
    question: "支払い方法は？",
    answer:
      "現金・銀行振込・各種キャッシュレス（ご相談ください）に対応しています。",
  },
  {
    question: "当日の追加依頼や延長は可能ですか？",
    answer:
      "当日のスケジュール次第ですが、可能な限り柔軟に対応いたします。スタッフへご相談ください。",
  },
  {
    question: "キャンセル料はかかりますか？",
    answer:
      "前日キャンセルは無料、当日キャンセルは作業代の50％を頂戴しております（事前連絡なしの不在は100％）。",
  },
];

/* =========================
   ページ辞書（ogImage は任意）
========================= */
const PAGES = {
  home: {
    path: "/",
    title: `${site.name}｜家事代行`,
    description:
      "大阪・兵庫エリア対応のハウスクリーニング／家事代行／整理収納のご案内。",
    ogType: "website",
  },
  about: {
    path: "/about",
    title: `私たちの想い｜${site.name}`,
    description:
      "お客様の暮らしに寄り添い、快適で清潔な空間づくりをサポートする私たちの理念。",
    ogType: "website",
  },
  news: {
    path: "/news",
    title: `お知らせ｜${site.name}`,
    description: `${site.name} の最新情報・キャンペーン・営業時間などのお知らせ。`,
    ogType: "website",
  },
  areasLocal: {
    path: "/areas/local",
    title: `東淀川区の家事代行・ハウスクリーニング｜${site.name}`,
    description:
      "東淀川区（淡路・上新庄…）で家事代行・ハウスクリーニング。定期/スポット対応。",
    ogType: "article",
  },
  products: {
    path: "/products",
    title: `サービス一覧｜${site.name}`,
    description: `${site.name}の家事代行・ハウスクリーニングのサービス一覧。水回り清掃や整理整頓、エアコン掃除などを掲載。`,
    ogType: "website",
    ogImage: "/ogp-products.jpg",
  },
  productsEC: {
    path: "/products-ec",
    title: `サービス一覧（オンライン予約）｜${site.name}`,
    description: `${site.name}のサービス一覧（オンライン予約対応）。水回り・キッチン・浴室など日常のお手伝いをプロが丁寧に実施。`,
    ogType: "website",
    ogImage: "/ogp-products.jpg",
  },
  projects: {
    path: "/projects",
    title: `サービス一覧｜${site.name}`,
    description: `${site.name}のサービス紹介ページ。水回り清掃、リビング清掃、整理収納などを写真付きで掲載。`,
    ogType: "website",
  },
  stores: {
    path: "/stores",
    title: `店舗一覧｜${site.name}`,
    description: `${site.name}の店舗一覧ページ。大阪・兵庫エリア対応の拠点情報をご紹介します。`,
    ogType: "website",
  },
  faq: {
    path: "/faq",
    title: `よくある質問（FAQ）｜${site.name}`,
    description: `料金・対応エリア・キャンセル・支払い方法など、${site.name}のハウスクリーニング／家事代行に関するよくある質問。`,
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
    ja: "大阪・兵庫（例：大阪市東淀川区／豊中市／吹田市 など）",
    en: "Osaka & Hyogo (e.g., local, Toyonaka, Suita)",
  },
  servicesByLang: {
    ja: ["ハウスクリーニング", "エアコンクリーニング", "家事代行", "整理収納"],
    en: ["house cleaning", "A/C cleaning", "housekeeping", "organizing"],
  },
  retail: true,
  productPageRoute: "/products",
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
