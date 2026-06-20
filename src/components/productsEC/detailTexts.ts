// src/components/productsEC/detailTexts.ts
import type { UILang } from "@/lib/atoms/uiLangAtom";

/* ▼ カートボタンの文言：多言語 */
export const ADD_TO_CART_T: Record<UILang, string> = {
  ja: "カートに入れる",
  en: "Add to cart",
  zh: "加入购物车",
  "zh-TW": "加入購物車",
  ko: "장바구니에 담기",
  fr: "Ajouter au panier",
  es: "Añadir al carrito",
  de: "In den Warenkorb",
  pt: "Adicionar ao carrinho",
  it: "Aggiungi al carrello",
  ru: "В корзину",
  th: "หยิบใส่ตะกร้า",
  vi: "Thêm vào giỏ",
  id: "Masukkan ke keranjang",
  hi: "कार्ट में जोड़ें",
  ar: "أضِف إلى السلة",
};

export function addToCartLabel(lang: UILang): string {
  return ADD_TO_CART_T[lang] ?? ADD_TO_CART_T.en;
}

/* ▼ 追加トーストの文言：多言語（{name} を商品名に差し込み） */
export const ADDED_TO_CART_T: Record<UILang, string> = {
  ja: "{name} をカートに追加しました",
  en: "Added {name} to your cart",
  zh: "已将 {name} 加入购物车",
  "zh-TW": "已將 {name} 加入購物車",
  ko: "{name} 을(를) 장바구니에 담았습니다",
  fr: "{name} ajouté à votre panier",
  es: "Has añadido {name} al carrito",
  de: "{name} wurde dem Warenkorb hinzugefügt",
  pt: "{name} adicionado ao carrinho",
  it: "Hai aggiunto {name} al carrello",
  ru: "{name} добавлен в корзину",
  th: "เพิ่ม {name} ลงในตะกร้าแล้ว",
  vi: "Đã thêm {name} vào giỏ hàng",
  id: "{name} telah ditambahkan ke keranjang",
  hi: "{name} कार्ट में जोड़ा गया",
  ar: "تمت إضافة {name} إلى السلة",
};

export function addedToCartText(lang: UILang, name: string): string {
  const template = ADDED_TO_CART_T[lang] ?? ADDED_TO_CART_T.en;
  return template.replace("{name}", name);
}

/** UI文言（在庫） */
export const STOCK_T: Record<
  UILang,
  {
    in: string;
    low: string;
    out: string;
    remain: (n: number) => string;
    max: (n: number) => string;
    addDisabled: string;
  }
> = {
  ja: {
    in: "在庫あり",
    low: "在庫少なめ",
    out: "在庫なし",
    remain: (n: number) => `残り${n}点`,
    max: (n: number) => `最大${n}個まで`,
    addDisabled: "在庫なし",
  },
  en: {
    in: "In stock",
    low: "Low stock",
    out: "Out of stock",
    remain: (n: number) => `only ${n} left`,
    max: (n: number) => `max ${n} pcs`,
    addDisabled: "Out of stock",
  },
  zh: {
    in: "有货",
    low: "库存紧张",
    out: "无货",
    remain: (n: number) => `仅剩 ${n} 件`,
    max: (n: number) => `最多 ${n} 件`,
    addDisabled: "无货",
  },
  "zh-TW": {
    in: "有現貨",
    low: "庫存緊張",
    out: "無庫存",
    remain: (n: number) => `剩餘 ${n} 件`,
    max: (n: number) => `最多 ${n} 件`,
    addDisabled: "無庫存",
  },
  ko: {
    in: "재고 있음",
    low: "재고 적음",
    out: "재고 없음",
    remain: (n: number) => `잔여 ${n}개`,
    max: (n: number) => `최대 ${n}개`,
    addDisabled: "재고 없음",
  },
  fr: {
    in: "En stock",
    low: "Stock faible",
    out: "En rupture",
    remain: (n: number) => `plus que ${n}`,
    max: (n: number) => `max ${n}`,
    addDisabled: "En rupture",
  },
  es: {
    in: "En stock",
    low: "Stock bajo",
    out: "Agotado",
    remain: (n: number) => `solo ${n} restantes`,
    max: (n: number) => `máx. ${n}`,
    addDisabled: "Agotado",
  },
  de: {
    in: "Auf Lager",
    low: "Geringer Bestand",
    out: "Nicht auf Lager",
    remain: (n: number) => `nur noch ${n}`,
    max: (n: number) => `max. ${n}`,
    addDisabled: "Nicht auf Lager",
  },
  pt: {
    in: "Em estoque",
    low: "Estoque baixo",
    out: "Sem estoque",
    remain: (n: number) => `restam apenas ${n}`,
    max: (n: number) => `máx. ${n}`,
    addDisabled: "Sem estoque",
  },
  it: {
    in: "Disponibile",
    low: "Scorte limitate",
    out: "Esaurito",
    remain: (n: number) => `ne restano solo ${n}`,
    max: (n: number) => `max ${n}`,
    addDisabled: "Esaurito",
  },
  ru: {
    in: "В наличии",
    low: "Малый остаток",
    out: "Нет в наличии",
    remain: (n: number) => `осталось ${n}`,
    max: (n: number) => `макс. ${n}`,
    addDisabled: "Нет в наличии",
  },
  th: {
    in: "มีสินค้า",
    low: "สินค้าเหลือน้อย",
    out: "สินค้าหมด",
    remain: (n: number) => `เหลือ ${n} ชิ้น`,
    max: (n: number) => `สูงสุด ${n} ชิ้น`,
    addDisabled: "สินค้าหมด",
  },
  vi: {
    in: "Còn hàng",
    low: "Sắp hết",
    out: "Hết hàng",
    remain: (n: number) => `chỉ còn ${n}`,
    max: (n: number) => `tối đa ${n}`,
    addDisabled: "Hết hàng",
  },
  id: {
    in: "Tersedia",
    low: "Stok menipis",
    out: "Habis",
    remain: (n: number) => `tersisa ${n}`,
    max: (n: number) => `maks ${n}`,
    addDisabled: "Habis",
  },
  hi: {
    in: "उपलब्ध",
    low: "कम स्टॉक",
    out: "स्टॉक समाप्त",
    remain: (n: number) => `केवल ${n} बचा है`,
    max: (n: number) => `अधिकतम ${n}`,
    addDisabled: "स्टॉक समाप्त",
  },
  ar: {
    in: "متوفر",
    low: "كمية محدودة",
    out: "غير متوفر",
    remain: (n: number) => `متبقي ${n}`,
    max: (n: number) => `حتى ${n}`,
    addDisabled: "غير متوفر",
  } as any,
};
