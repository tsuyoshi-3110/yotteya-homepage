// src/components/productsEC/texts.ts
import type { UILang } from "@/lib/atoms/uiLangAtom";

/* ===== リンク先パス ===== */
export const TERMS_PATH = "/terms";
export const REFUND_PATH = "/refund";

/* ===== 返品・利用規約 ===== */
export const REFUND_T: Record<UILang, string> = {
  ja: "返品・返金ポリシー",
  en: "Refund Policy",
  zh: "退款与退货政策",
  "zh-TW": "退款與退貨政策",
  ko: "환불 및 반품 정책",
  fr: "Politique de remboursement",
  es: "Política de reembolsos",
  de: "Richtlinie zu Rückerstattungen",
  pt: "Política de reembolso",
  it: "Politica di rimborso",
  ru: "Политика возвратов",
  th: "นโยบายการคืนเงิน",
  vi: "Chính sách hoàn tiền",
  id: "Kebijakan pengembalian dana",
  hi: "रिफंड नीति",
  ar: "سياسة الاسترجاع",
};

export const TERMS_T: Record<UILang, string> = {
  ja: "利用規約（購入規約）",
  en: "Terms of Purchase",
  zh: "购买条款",
  "zh-TW": "購買條款",
  ko: "이용약관(구매)",
  fr: "Conditions d’achat",
  es: "Términos de compra",
  de: "Kaufbedingungen",
  pt: "Termos de compra",
  it: "Condizioni di acquisto",
  ru: "Условия покупки",
  th: "เงื่อนไขการสั่งซื้อ",
  vi: "Điều khoản mua hàng",
  id: "Syarat pembelian",
  hi: "खरीद शर्तें",
  ar: "شروط الشراء",
};

/* ===== ラベル多言語 ===== */
export const ALL_CATEGORY_T: Record<UILang, string> = {
  ja: "全カテゴリー",
  en: "All categories",
  zh: "全部分类",
  "zh-TW": "全部分類",
  ko: "모든 카테고리",
  fr: "Toutes les catégories",
  es: "Todas las categorías",
  de: "Alle Kategorien",
  pt: "Todas as categorias",
  it: "Tutte le categorie",
  ru: "Все категории",
  th: "ทุกหมวดหมู่",
  vi: "Tất cả danh mục",
  id: "Semua kategori",
  hi: "सभी श्रेणियाँ",
  ar: "كل الفئات",
};

/* ===== 見出し（ショップ名） ===== */
export const SHOP_TITLE_T: Record<UILang, string> = {
  ja: "オンラインショップ",
  en: "Online Shop",
  zh: "在线商店",
  "zh-TW": "線上商店",
  ko: "온라인 쇼핑",
  fr: "Boutique en ligne",
  es: "Tienda en línea",
  de: "Onlineshop",
  pt: "Loja online",
  it: "Negozio online",
  ru: "Интернет-магазин",
  th: "ร้านค้าออนไลน์",
  vi: "Cửa hàng trực tuyến",
  id: "Toko online",
  hi: "ऑनलाइन दुकान",
  ar: "المتجر الإلكتروني",
};

export const SHOP_SUBTITLE_T: Record<UILang, string> = {
  ja: "公式オンラインストア",
  en: "Official Online Store",
  zh: "官方在线商店",
  "zh-TW": "官方線上商店",
  ko: "공식 온라인 스토어",
  fr: "Boutique en ligne officielle",
  es: "Tienda en línea oficial",
  de: "Offizieller Onlineshop",
  pt: "Loja online oficial",
  it: "Negozio online ufficiale",
  ru: "Официальный интернет-магазин",
  th: "ร้านค้าออนไลน์อย่างเป็นทางการ",
  vi: "Cửa hàng trực tuyến chính thức",
  id: "Toko online resmi",
  hi: "आधिकारिक ऑनलाइन स्टोर",
  ar: "المتجر الإلكتروني الرسمي",
};

export const INTERNATIONAL_FEES_NOTICE_T: Record<UILang, string> = {
  ja: "海外配送では関税・輸入税・通関手数料等が発生する場合があり、原則として受取人様のご負担となります。",
  en: "For international shipping, customs duties, import taxes, and clearance fees may apply and are, in principle, the recipient’s responsibility.",
  zh: "海外配送可能会产生关税、进口税及清关手续费，原则上由收件人承担。",
  "zh-TW": "海外配送可能會產生關稅、進口稅及清關手續費，原則上由收件人負擔。",
  ko: "해외 배송의 경우 관세·수입세·통관 수수료 등이 발생할 수 있으며, 원칙적으로 수령인 부담입니다。",
  fr: "Pour les envois internationaux, des droits de douane, taxes d’importation et frais de dédouanement peuvent s’appliquer et sont, en principe, à la charge du destinataire.",
  es: "En los envíos internacionales pueden aplicarse aranceles, impuestos de importación y gastos de despacho aduanero, que en principio corren a cargo del destinatario.",
  de: "Bei internationalen Sendungen können Zölle, Einfuhrsteuern und Verzollungsgebühren anfallen; diese gehen grundsätzlich zu Lasten des Empfängers.",
  pt: "Em envios internacionais, podem ser cobrados impostos de importação, taxas alfandegárias e tarifas de desembaraço, que, em princípio, são de responsabilidade do destinatário.",
  it: "Per le spedizioni internazionali potrebbero applicarsi dazi, imposte d’importazione e spese di sdoganamento, che in linea di principio sono a carico del destinatario.",
  ru: "При международной доставке могут взиматься таможенные пошлины, импортные налоги и сборы za оформление; как правило, их оплачивает получатель.",
  th: "การจัดส่งไปต่างประเทศอาจมีอากรขาเข้า ภาษีนำเข้า และค่าดำเนินการศุลกากร ซึ่งโดยหลักแล้วผู้รับเป็นผู้รับผิดชอบค่าใช้จ่ายดังกล่าว",
  vi: "Đối với giao hàng quốc tế, có thể phát sinh thuế nhập khẩu, thuế và phí thông quan; về nguyên tắc, người nhận phải chịu các chi phí này.",
  id: "Untuk pengiriman internasional, bea masuk, pajak impor, dan biaya kepabeanan dapat dikenakan dan pada prinsipnya menjadi tanggung jawab penerima.",
  hi: "अंतरराष्ट्रीय शिपिंग में कस्टम ड्यूटी, आयात कर और क्लियरेंस शुल्क लग सकते हैं, जो सिद्धांततः प्राप्तकर्ता के जिम्मे होते हैं।",
  ar: "قد تُفرض عند الشحن الدولي رسوم جمركية وضرائب استيراد ورسوم تخليص جمركي، وتكون هذه التكاليف من حيث المبدأ على عاتق المستلِم.",
};
