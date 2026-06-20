/**
 * Pageit 顧客別設定
 *
 * 新しい顧客サイトを作るときは、原則としてこのファイルだけを編集します。
 * Firebase / Stripe / Google の秘密鍵はここへ書かず、.env.local と Vercel で管理してください。
 */
export const CUSTOMER = {
  /**
   * "template": このサイトに用意された既存翻訳を利用
   * "customer-default": 他言語でも下記の顧客用日本語コピーを表示し、旧顧客の翻訳を残さない
   * 新規顧客へ複製するときは "customer-default" を推奨
   */
  localizedContentMode: "template" as "template" | "customer-default",
  siteKey: "yotteya",
  productionUrl: "https://yotteya.shop",
  vercelUrl: "https://yotteya-homepage-tsuyoshi-saitos-projects.vercel.app",

  brand: {
    name: "甘味処 よって屋",
    shortName: "よって屋",
    copyrightName: "Tayotteya",
    businessCategory: "クレープ専門店",
    tagline: "大阪市のクレープ専門店",
    description:
      "大阪市東淀川区・北区に展開するクレープ専門店『甘味処 よって屋』。注文ごとに生地から焼き上げるこだわりのクレープをご提供。テイクアウト・イートイン対応。",
    telephone: "",
    logoPath: "/images/ogpLogo.png",
    googleSiteVerification:
      "UcH7-5B4bwpJxxSjIpBskahFhBRTSLRJUZ8A3LAnnFE",
    keywords: [
      "甘味処クレープよって屋",
      "よって屋",
      "甘味処",
      "クレープ",
      "大阪",
      "東淀川区",
      "北区",
      "下新庄",
      "淡路",
      "クレープ専門店",
    ],
  },

  social: {
    instagram: "https://www.instagram.com/yotteya.crape/",
    line: "https://lin.ee/YcKAJja",
    x: "",
    facebook: "",
    youtube: "",
    tiktok: "",
  },

  address: {
    text: "大阪市東淀川区淡路４丁目１８−１６",
    postalCode: "",
    country: "JP",
    region: "大阪府",
    locality: "大阪市東淀川区",
    street: "淡路４丁目１８−１６",
    latitude: 34.739,
    longitude: 135.516,
  },

  seo: {
    homeTitle: "東淀川区のクレープ専門店｜甘味処 よって屋",
    homeDescription:
      "大阪市東淀川区・淡路のクレープ専門店『甘味処 よって屋』。注文ごとに生地から焼き上げるこだわりクレープをご提供。テイクアウト・イートイン対応。",
    localTitle: "東淀川区のクレープ専門店｜甘味処 よって屋",
    localDescription:
      "大阪市東淀川区・淡路でクレープをお探しなら「甘味処 よって屋」へ。焼きたてクレープをテイクアウト・イートインで楽しめます。",
    aboutDescription:
      "甘味処 よって屋の想いをご紹介します。素材へのこだわりとお客様への気持ちを込めたメッセージ。",
    productsDescription:
      "甘味処 よって屋のクレープメニュー一覧。季節限定・定番・カスタマイズ可能なクレープを掲載。",
    productsEcDescription:
      "甘味処 よって屋のオンライン対応メニュー一覧。お気に入りのクレープをチェック。",
    projectsTitle: "クレープ紹介｜甘味処 よって屋",
    projectsDescription:
      "甘味処 よって屋のクレープ紹介ページ。季節のフルーツ・定番クリーム・チョコバナナなどを写真付きで掲載。",
    storesDescription:
      "甘味処 よって屋の店舗一覧ページ。大阪市東淀川区・北区の店舗情報をご紹介します。",
    faqDescription:
      "テイクアウト・支払い方法・売り切れ情報など、甘味処 よって屋のクレープに関するよくある質問。",
  },

  home: {
    headline: "甘味処 よって屋",
    description:
      "大阪市東淀川区・北区に展開するクレープ専門店です。注文ごとに生地から焼き上げるこだわりのクレープをご提供しています。テイクアウトはもちろん、店舗によってはイートインもご利用いただけます。お買い物や学校帰りなど、さまざまなシーンでお気軽にお立ち寄りください。",
  },

  stores: {
    heroTitle: "甘味処 よって屋 ─ 店舗一覧",
    heroAreas: "大阪市東淀川区・北区",
    heroLead: "こだわりのクレープをご提供するクレープ専門店です。",
    heroTail:
      "駅チカ店から住宅街の隠れ家店まで、各店舗の営業時間・限定メニューをチェックしてください。",
    heroIntroLine:
      "甘味処 よって屋は大阪市東淀川区・北区に展開するクレープ専門店です。",
  },

  localPage: {
    schemaType: "FoodEstablishment",
    cuisines: ["クレープ", "スイーツ"],
    priceRange: "￥￥",
    areaName: "大阪市東淀川区",
    areaLabel: "大阪市東淀川区・淡路",
    footerLinkText: "東淀川区の甘味処・クレープ",
    h1: "大阪市東淀川区のクレープ専門店 甘味処 よって屋",
    lead:
      "淡路・上新庄・だいどう豊里・井高野・柴島など東淀川区全域からご来店いただいています。",
    introduction:
      "注文をいただいてから生地を焼き上げ、できたてのクレープをご提供しています。テイクアウトはもちろん、店舗ではイートインもご利用いただけます。",
    accessTitle: "淡路の店舗・アクセス",
    coverageTitle: "対応エリア（東淀川区）",
    coverageBody:
      "淡路・東淡路・菅原・豊新・上新庄・瑞光・小松・南江口・北江口・井高野・大桐・大隅・豊里・大道南・柴島・下新庄 ほか",
    closingText:
      "東淀川区でクレープやスイーツをお探しの際は、お買い物帰り、学校帰り、ご家族とのおやつなどにお気軽にお立ち寄りください。",
    faqTitle: "東淀川区の店舗についてよくある質問",
    menuLinkText: "クレープメニューを見る",
    storesLinkText: "店舗情報を見る",
    homeLinkText: "トップページへ戻る",
    services: [
      {
        title: "人気メニュー",
        bullets: [
          "季節のフルーツクレープ（限定）",
          "カスタード＆生クリーム（自家製ソース）",
          "チョコバナナ／いちごみるく ほか定番",
        ],
      },
      {
        title: "ご利用シーン",
        bullets: [
          "テイクアウト・食べ歩き",
          "ちょっとした手土産・差し入れ",
          "お子さま連れ・放課後のおやつに",
        ],
      },
    ],
    faq: [
      {
        q: "テイクアウトはできますか？",
        a: "すべてテイクアウト可能です。生クリーム多めなどのカスタムもお気軽にどうぞ。",
      },
      {
        q: "売り切れはありますか？",
        a: "季節限定メニューは材料がなくなり次第終了となる場合があります。最新情報はInstagramでお知らせしています。",
      },
      {
        q: "支払い方法は何がありますか？",
        a: "現金のほか、主要キャッシュレス決済に対応しています。詳細は店頭でご確認ください。",
      },
    ],
  },

  structuredData: {
    types: ["LocalBusiness", "FoodEstablishment"],
    defaultDescription:
      "大阪市東淀川区・淡路のクレープ専門店。焼きたてのクレープをテイクアウト・イートインで楽しめます。",
    areaServed: ["大阪府", "大阪市東淀川区", "大阪市北区"],
    openingHours: {
      dayOfWeek: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ],
      opens: "09:00",
      closes: "18:00",
    },
  },

  faq: [
    {
      question: "テイクアウトはできますか？",
      answer:
        "すべてのメニューをテイクアウトでご利用いただけます。生クリーム多めなどのカスタムもお気軽にお申し付けください。",
    },
    {
      question: "売り切れはありますか？",
      answer:
        "季節限定メニューや人気商品は、材料がなくなり次第終了となる場合があります。最新情報は公式SNSでお知らせしています。",
    },
    {
      question: "支払い方法は？",
      answer:
        "現金のほか、主要なキャッシュレス決済に対応しています。詳細は店頭でご確認ください。",
    },
    {
      question: "イートインはできますか？",
      answer:
        "店舗によってはイートインスペースをご用意しています。各店舗の情報は店舗一覧ページをご確認ください。",
    },
    {
      question: "アレルギー対応はしていますか？",
      answer:
        "原材料のアレルギー情報については店頭スタッフにお問い合わせください。",
    },
  ],

  ai: {
    areasJa: "大阪市東淀川区・北区（淡路・上新庄・下新庄 など）",
    areasEn:
      "Higashiyodogawa & Kita, Osaka (e.g., Awaji, Kamishinjo, Shimoshinjo)",
    servicesJa: ["クレープ", "テイクアウト", "イートイン", "季節限定メニュー"],
    servicesEn: ["crepe", "takeout", "eat-in", "seasonal limited menu"],
    retail: true,
    productPageRoute: "/products",
  },
} as const;

export type CustomerConfig = typeof CUSTOMER;
