"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import Image from "next/image";
import clsx from "clsx";
import { useThemeGradient } from "@/lib/useThemeGradient";
import { useHeaderLogoUrl } from "../hooks/useHeaderLogoUrl";
import { auth, db } from "@/lib/firebase";
import UILangFloatingPicker from "./UILangFloatingPicker";
import { useUILang, type UILang as UILangType } from "@/lib/atoms/uiLangAtom";
import { doc, onSnapshot } from "firebase/firestore";
import { SITE_KEY } from "@/lib/atoms/siteKeyAtom";
import { ThemeKey, THEMES } from "@/lib/themes";

const META_REF = doc(db, "siteSettingsEditable", SITE_KEY);

const SNS = [
  {
    name: "Instagram",
    href: "https://www.instagram.com/yotteya.crape/",
    image: "/images/instagram-logo.png",
  },
];

const HEADER_H = "3rem";
const TRIPLE_TAP_INTERVAL_MS = 500;
const IGNORE_SELECTOR = "a,button,input,select,textarea,[role='button']";

/* ===== 多言語辞書 ===== */
// 省略なく原文のまま
// --- start i18n ---
type Keys =
  | "menuTitle"
  | "home"
  | "products"
  | "stores"
  | "delivery"
  | "about"
  | "company"
  | "news"
  | "interview"
  | "timeline"
  | "community"
  | "analytics"
  // | "cart"
  // | "productEC"
  // | "orders"
  | "admin";

const T: Record<UILangType, Record<Keys, string>> = {
  ja: {
    menuTitle: "メニュー",
    home: "ホーム",
    products: "商品一覧",
    stores: "店舗一覧",
    delivery: "デリバリー",
    about: "当店の思い",
    company: "会社概要",
    news: "お知らせ",
    interview: "取材はこちら",
    timeline: "タイムライン",
    community: "コミュニティ",
    analytics: "分析",
    // cart: "カート",
    // productEC: "商品販売",
    // orders: "注文履歴",
    admin: "管理者ログイン",
  },
  en: {
    menuTitle: "Menu",
    home: "Home",
    products: "Products",
    stores: "Access",
    delivery: "Delivery",
    about: "Our Story",
    company: "Company",
    news: "News",
    interview: "Press & Inquiries",
    timeline: "Timeline",
    community: "Community",
    analytics: "Analytics",
    // cart: "Cart",
    // productEC: "Shop",
    // orders: "Orders",
    admin: "Administrator Login",
  },
  zh: {
    menuTitle: "菜单",
    home: "首页",
    products: "商品一览",
    stores: "交通/访问",
    delivery: "外送",
    about: "我们的理念",
    company: "公司简介",
    news: "通知",
    interview: "媒体采访",
    timeline: "时间线",
    community: "社区",
    analytics: "分析",
    // cart: "购物车",
    // productEC: "商品销售",
    // orders: "订单历史",
    admin: "管理员登录",
  },
  "zh-TW": {
    menuTitle: "選單",
    home: "首頁",
    products: "商品一覽",
    stores: "交通/位置",
    delivery: "外送",
    about: "我們的理念",
    company: "公司簡介",
    news: "最新消息",
    interview: "媒體採訪",
    timeline: "時間軸",
    community: "社群",
    analytics: "分析",
    // cart: "購物車",
    // productEC: "商品銷售",
    // orders: "訂單歷史",
    admin: "管理者登入",
  },
  ko: {
    menuTitle: "메뉴",
    home: "홈",
    products: "상품 목록",
    stores: "오시는 길",
    delivery: "딜리버리",
    about: "가게 이야기",
    company: "회사 소개",
    news: "알림",
    interview: "취재 문의",
    timeline: "타임라인",
    community: "커뮤니티",
    analytics: "분석",
    // cart: "장바구니",
    // productEC: "상품 판매",
    // orders: "주문 내역",
    admin: "관리자 로그인",
  },
  fr: {
    menuTitle: "Menu",
    home: "Accueil",
    products: "Produits",
    stores: "Accès",
    delivery: "Livraison",
    about: "Notre histoire",
    company: "Entreprise",
    news: "Actualités",
    interview: "Presse",
    timeline: "Timeline",
    community: "Communauté",
    analytics: "Analyses",
    // cart: "Panier",
    // productEC: "Boutique",
    // orders: "Commandes",
    admin: "Connexion administrateur",
  },
  es: {
    menuTitle: "Menú",
    home: "Inicio",
    products: "Productos",
    stores: "Acceso",
    delivery: "Entrega",
    about: "Nuestra historia",
    company: "Empresa",
    news: "Noticias",
    interview: "Prensa",
    timeline: "Cronología",
    community: "Comunidad",
    analytics: "Analítica",
    // cart: "Carrito",
    // productEC: "Tienda",
    // orders: "Pedidos",
    admin: "Inicio de sesión administrador",
  },
  de: {
    menuTitle: "Menü",
    home: "Startseite",
    products: "Produkte",
    stores: "Anfahrt",
    delivery: "Lieferung",
    about: "Unsere Geschichte",
    company: "Unternehmen",
    news: "Neuigkeiten",
    interview: "Presse",
    timeline: "Timeline",
    community: "Community",
    analytics: "Analytik",
    // cart: "Warenkorb",
    // productEC: "Shop",
    // orders: "Bestellungen",
    admin: "Admin-Anmeldung",
  },
  pt: {
    menuTitle: "Menu",
    home: "Início",
    products: "Produtos",
    stores: "Acesso",
    delivery: "Delivery",
    about: "Nossa história",
    company: "Empresa",
    news: "Notícias",
    interview: "Imprensa",
    timeline: "Linha do tempo",
    community: "Comunidade",
    analytics: "Análises",
    // cart: "Carrinho",
    // productEC: "Loja",
    // orders: "Pedidos",
    admin: "Login do administrador",
  },
  it: {
    menuTitle: "Menu",
    home: "Home",
    products: "Prodotti",
    stores: "Accesso",
    delivery: "Consegna",
    about: "La nostra storia",
    company: "Azienda",
    news: "Notizie",
    interview: "Stampa",
    timeline: "Timeline",
    community: "Community",
    analytics: "Analitiche",
    // cart: "Carrello",
    // productEC: "Negozio",
    // orders: "Ordini",
    admin: "Accesso amministratore",
  },
  ru: {
    menuTitle: "Меню",
    home: "Главная",
    products: "Товары",
    stores: "Как добраться",
    delivery: "Доставка",
    about: "О нас",
    company: "О компании",
    news: "Новости",
    interview: "Для прессы",
    timeline: "Лента",
    community: "Сообщество",
    analytics: "Аналитика",
    // cart: "Корзина",
    // productEC: "Магазин",
    // orders: "Заказы",
    admin: "Вход администратора",
  },
  th: {
    menuTitle: "เมนู",
    home: "หน้าแรก",
    products: "รายการสินค้า",
    stores: "การเดินทาง",
    delivery: "เดลิเวอรี่",
    about: "เรื่องราวของเรา",
    company: "ข้อมูลบริษัท",
    news: "ประกาศ",
    interview: "ติดต่อสื่อ",
    timeline: "ไทม์ไลน์",
    community: "คอมมูนิตี้",
    analytics: "วิเคราะห์",
    // cart: "ตะกร้า",
    // productEC: "ร้านค้า",
    // orders: "คำสั่งซื้อ",
    admin: "เข้าสู่ระบบผู้ดูแล",
  },
  vi: {
    menuTitle: "Menu",
    home: "Trang chủ",
    products: "Danh mục",
    stores: "Đường đi",
    delivery: "Giao hàng",
    about: "Câu chuyện của chúng tôi",
    company: "Hồ sơ công ty",
    news: "Thông báo",
    interview: "Báo chí",
    timeline: "Dòng thời gian",
    community: "Cộng đồng",
    analytics: "Phân tích",
    // cart: "Giỏ hàng",
    // productEC: "Cửa hàng",
    // orders: "Đơn hàng",
    admin: "Đăng nhập quản trị",
  },
  id: {
    menuTitle: "Menu",
    home: "Beranda",
    products: "Daftar produk",
    stores: "Akses",
    delivery: "Delivery",
    about: "Kisah kami",
    company: "Profil perusahaan",
    news: "Pemberitahuan",
    interview: "Untuk media",
    timeline: "Linimasa",
    community: "Komunitas",
    analytics: "Analitik",
    // cart: "Keranjang",
    // productEC: "Toko",
    // orders: "Pesanan",
    admin: "Masuk admin",
  },
  hi: {
    menuTitle: "मेनू",
    home: "होम",
    products: "उत्पाद सूची",
    stores: "पहुँच",
    delivery: "डिलीवरी",
    about: "हमारी कहानी",
    company: "कंपनी प्रोफ़ाइल",
    news: "सूचनाएँ",
    interview: "प्रेस",
    timeline: "टाइमलाइन",
    community: "समुदाय",
    analytics: "विश्लेषण",
    // cart: "कार्ट",
    // productEC: "दुकान",
    // orders: "आदेश",
    admin: "प्रशासक लॉगिन",
  },
  ar: {
    menuTitle: "القائمة",
    home: "الصفحة الرئيسية",
    products: "قائمة المنتجات",
    stores: "الوصول",
    delivery: "التوصيل",
    about: "قصتنا",
    company: "نبذة عن الشركة",
    news: "الإشعارات",
    interview: "للاعلام",
    timeline: "الخط الزمني",
    community: "المجتمع",
    analytics: "التحليلات",
    // cart: "عربة التسوق",
    // productEC: "المتجر",
    // orders: "الطلبات",
    admin: "تسجيل دخول المسؤول",
  },
};
// --- end i18n ---

/* ===== メニューキー ===== */
type MenuKey =
  | "products"
  | "home"
  | "stores"
  | "delivery"
  | "about"
  | "company"
  | "news"
  | "interview"
  | "timeline"
  | "community"
  | "analytics"
  // | "cart"
  // | "productEC"
  // | "orders"
  | "admin";

type MenuItem = {
  key: MenuKey;
  href: string;
  external?: boolean;
};

const MENU_ITEMS: MenuItem[] = [
  { key: "home", href: "/" },
  { key: "products", href: "/products" },
  // { key: "productEC", href: "/productsEC" },
  // { key: "cart", href: "/cart" },
  { key: "stores", href: "/stores" },
  {
    key: "delivery",
    href: "https://www.ubereats.com/store/...",
    external: true,
  },
  { key: "about", href: "/about" },
  { key: "company", href: "/company" },
  { key: "news", href: "/news" },
  { key: "interview", href: "/blog" },
];

const FOOTER_ITEMS: MenuItem[] = [
  { key: "timeline", href: "/postList" },
  { key: "community", href: "/community" },
  { key: "analytics", href: "/analytics" },
  // { key: "orders", href: "/orders" },
  { key: "admin", href: "/login" },
];

export default function Header({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const gradient = useThemeGradient();
  const logoUrl = useHeaderLogoUrl();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const isDark = useMemo(() => {
    const darkThemes: ThemeKey[] = ["brandG", "brandH", "brandI"];
    if (!gradient) return false;
    return darkThemes.some((k) => gradient === THEMES[k]);
  }, [gradient]);

  const { uiLang } = useUILang();
  const t = T[uiLang] ?? T.ja;
  const rtl = uiLang === "ar";

  // Firestore のメニュー表示制御
  const [visibleMenuKeys, setVisibleMenuKeys] = useState<MenuKey[]>(
    [...MENU_ITEMS, ...FOOTER_ITEMS].map((m) => m.key)
  );
  useEffect(() => {
    const unsub = onSnapshot(META_REF, (snap) => {
      const data = snap.data() as { visibleMenuKeys?: MenuKey[] } | undefined;
      if (Array.isArray(data?.visibleMenuKeys) && data.visibleMenuKeys.length) {
        setVisibleMenuKeys(data.visibleMenuKeys);
      }
    });
    return () => unsub();
  }, []);

  // ログイン状態
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => setIsLoggedIn(!!user));
    return () => unsub();
  }, []);

  // グラデーション適用
  const gradientClass = gradient
    ? gradient.startsWith("bg-[")
      ? gradient
      : `bg-gradient-to-b ${gradient}`
    : "bg-gray-100";

  // 秘密の3タップ → 管理者リンク表示
  const [showAdminLink, setShowAdminLink] = useState(false);
  const tapCountRef = useRef(0);
  const lastTapAtRef = useRef(0);
  useEffect(() => {
    if (!open) {
      setShowAdminLink(false);
      tapCountRef.current = 0;
      lastTapAtRef.current = 0;
    }
  }, [open]);

  const handleSecretTap = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest(IGNORE_SELECTOR)) return;
    const now = Date.now();
    const last = lastTapAtRef.current;
    if (now - last > TRIPLE_TAP_INTERVAL_MS) {
      tapCountRef.current = 1;
      lastTapAtRef.current = now;
      return;
    }
    tapCountRef.current += 1;
    lastTapAtRef.current = now;
    if (tapCountRef.current >= 3) {
      setShowAdminLink(true);
      tapCountRef.current = 0;
      lastTapAtRef.current = 0;
    }
  };

  const handleMenuClose = () => setOpen(false);

  return (
    <header
      className={clsx(
        "sticky top-0 z-30 flex items-center justify-between px-4 h-12",
        gradientClass,
        className
      )}
      style={{ "--header-h": HEADER_H } as React.CSSProperties}
    >
      {/* ロゴ */}
      <Link
        href="/"
        className={clsx(
          "text-md font-bold flex items-center gap-2 py-2 hover:opacity-50",
          isDark ? "text-white text-outline" : "text-black"
        )}
        onClick={handleMenuClose}
      >
        {logoUrl && logoUrl.trim() !== "" && (
          <Image
            src={logoUrl}
            alt="ロゴ"
            width={48}
            height={48}
            className="w-12 h-12 object-contain transition-opacity duration-200"
            unoptimized
          />
        )}
        甘味処 クレープよって屋
      </Link>

      {/* SNS */}
      <nav
        className={clsx("flex gap-4 ml-auto mr-2", rtl && "flex-row-reverse")}
      >
        {SNS.map(({ name, href, image }) => (
          <a
            key={name}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={name}
            className="hover:opacity-80 transition"
            onClick={handleMenuClose}
          >
            <Image
              src={image}
              alt={name}
              width={26}
              height={26}
              className="w-7 h-7 object-contain"
            />
          </a>
        ))}
      </nav>

      {/* 外部リンク */}
      <Link
        href="https://tayotteya.com/"
        className={clsx(
          "text-xl font-bold flex items-center gap-2 py-2 hover:opacity-50",
          isDark ? "text-white" : "text-black"
        )}
        onClick={handleMenuClose}
      >
        <Image
          src="/images/tayotteya_circle_image.png"
          alt="Home"
          width={32}
          height={32}
          className="w-7 h-7 object-contain transition-opacity duration-200 mr-2"
          unoptimized
        />
      </Link>

      {/* ハンバーガー */}
      <div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={clsx(
                "w-8 h-8 border-2",
                isDark ? "text-white border-white" : "text-black border-black"
              )}
              aria-label={t.menuTitle}
            >
              <Menu size={22} />
            </Button>
          </SheetTrigger>

          {/* === スマホで下が見切れる問題対策 ===
              - h-dvh: 端末の表示領域の高さを正しく反映
              - overflow-hidden + 内側に overflow-y-auto のスクロール領域
              - pb-[env(safe-area-inset-bottom)] でホームバー回避
          */}
          <SheetContent
            side="right"
            dir={rtl ? "rtl" : "ltr"}
            className={clsx(
              "flex h-dvh flex-col overflow-hidden p-0",
              gradient &&
                (gradient.startsWith("bg-[")
                  ? gradient
                  : `bg-gradient-to-b ${gradient}`),
              // Close ボタンのサイズはそのまま
              "[&_[data-radix-sheet-close]]:w-10 [&_[data-radix-sheet-close]]:h-10",
              "[&_[data-radix-sheet-close]_svg]:w-6 [&_[data-radix-sheet-close]_svg]:h-6"
            )}
          >
            <SheetHeader className="pt-4 px-4">
              <SheetTitle className="text-center text-xl text-white text-outline">
                {t.menuTitle}
              </SheetTitle>
            </SheetHeader>

            {/* スクロール本体 */}
            <div
              className="flex-1 overflow-y-auto [scrollbar-width:thin] px-6 pb-6"
              onPointerDown={handleSecretTap}
            >
              {/* メインメニュー（中央寄せ） */}
              <div className="min-h-[60vh] flex flex-col justify-center items-center space-y-4 text-center">
                {MENU_ITEMS.filter((m) => visibleMenuKeys.includes(m.key)).map(
                  ({ key, href, external }) =>
                    external ? (
                      <a
                        key={key}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={handleMenuClose}
                        className="text-lg text-white text-outline hover:underline"
                      >
                        {t[key]}
                      </a>
                    ) : (
                      <Link
                        key={key}
                        href={href}
                        onClick={handleMenuClose}
                        className="text-lg text-white text-outline"
                      >
                        {t[key]}
                      </Link>
                    )
                )}
              </div>

              {/* 言語ピッカー */}
              <div className="flex flex-col items-center gap-3 py-4">
                <UILangFloatingPicker />
              </div>

              {/* フッターメニュー（ログイン状況に応じて表示） */}
              <div className="py-6">
                <div className="flex flex-col items-center gap-3">
                  {/* timeline / community / analytics は要ログイン */}
                  {isLoggedIn &&
                    FOOTER_ITEMS.filter((m) =>
                      ["timeline", "community", "analytics"].includes(m.key)
                    )
                      .filter((m) => visibleMenuKeys.includes(m.key as MenuKey))
                      .map(({ key, href }) => (
                        <Link
                          key={key}
                          href={href}
                          onClick={handleMenuClose}
                          className="text-center text-lg text-white text-outline"
                        >
                          {t[key as Keys]}
                        </Link>
                      ))}

                  {/* 注文履歴: ★ FIX - 表示されない問題の修正
                      条件: ログイン済み かつ Firestore の visibleMenuKeys に含まれる */}
                  {/* {isLoggedIn && visibleMenuKeys.includes("orders") && (
                    <Link
                      href="/orders"
                      onClick={handleMenuClose}
                      className="text-center text-lg text-white text-outline"
                    >
                      {t.orders}
                    </Link>
                  )} */}

                  {/* 管理者リンク（3タップ or ログイン） */}
                  {(showAdminLink || isLoggedIn) &&
                    visibleMenuKeys.includes("admin") && (
                      <Link
                        href="/login"
                        onClick={handleMenuClose}
                        className="text-center text-lg text-white text-outline"
                      >
                        {t.admin}
                      </Link>
                    )}
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
