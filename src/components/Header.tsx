"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Menu, Instagram } from "lucide-react";
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

const META_REF = doc(db, "siteSettingsEditable", SITE_KEY);

const SNS = [
  {
    name: "Instagram",
    href: "https://www.instagram.com/yotteya.crape/",
    icon: Instagram,
  },
];

const HEADER_H = "3rem";
const TRIPLE_TAP_INTERVAL_MS = 500;
const IGNORE_SELECTOR = "a,button,input,select,textarea,[role='button']";

/* ===== 多言語辞書 ===== */
type Keys =
  | "menuTitle"
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
  | "admin";

const T: Record<UILangType, Record<Keys, string>> = {
  ja: {
    menuTitle: "メニュー",
    products: "商品一覧",
    stores: "アクセス",
    delivery: "デリバリー",
    about: "当店の思い",
    company: "会社概要",
    news: "お知らせ",
    interview: "取材はこちら",
    timeline: "タイムライン",
    community: "コミュニティ",
    analytics: "分析",
    admin: "管理者ログイン",
  },
  en: {
    menuTitle: "Menu",
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
    admin: "Administrator Login",
  },
  zh: {
    menuTitle: "菜单",
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
    admin: "管理员登录",
  },
  "zh-TW": {
    menuTitle: "選單",
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
    admin: "管理者登入",
  },
  ko: {
    menuTitle: "메뉴",
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
    admin: "관리자 로그인",
  },
  fr: {
    menuTitle: "Menu",
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
    admin: "Connexion administrateur",
  },
  es: {
    menuTitle: "Menú",
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
    admin: "Inicio de sesión administrador",
  },
  de: {
    menuTitle: "Menü",
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
    admin: "Admin-Anmeldung",
  },
  pt: {
    menuTitle: "Menu",
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
    admin: "Login do administrador",
  },
  it: {
    menuTitle: "Menu",
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
    admin: "Accesso amministratore",
  },
  ru: {
    menuTitle: "Меню",
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
    admin: "Вход администратора",
  },
  th: {
    menuTitle: "เมนู",
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
    admin: "เข้าสู่ระบบผู้ดูแล",
  },
  vi: {
    menuTitle: "Menu",
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
    admin: "Đăng nhập quản trị",
  },
  id: {
    menuTitle: "Menu",
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
    admin: "Masuk admin",
  },
  hi: {
    menuTitle: "मेनू",
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
    admin: "प्रशासक लॉगिन",
  },
  ar: {
    menuTitle: "القائمة",
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
    admin: "تسجيل دخول المسؤول",
  },
};

// メニューキー（Loginと揃える）
type MenuKey =
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
  | "admin";

type MenuItem = {
  key: MenuKey;
  href: string;
  external?: boolean;
};

const MENU_ITEMS: MenuItem[] = [
  { key: "products", href: "/products" },
  { key: "stores", href: "/stores" },
  {
    key: "delivery",
    href: "https://www.ubereats.com/store/%E3%81%97%E3%82%85%E3%82%8F%E3%81%A3%E3%81%A8%E8%B4%85%E6%B2%A2%E3%83%8F%E3%82%BF%E3%83%BC%E3%81%AE%E3%82%84%E3%81%BF%E3%81%A4%E3%81%8D%E3%82%AF%E3%83%AC%E3%83%BC%E3%83%95-%E3%82%88%E3%81%A3%E3%81%A6%E5%B1%8B/ycwuMM91VIaoNcZ1oCr_5g?diningMode=DELIVERY",
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
  { key: "admin", href: "/login" },
];

export default function Header({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const gradient = useThemeGradient();
  const logoUrl = useHeaderLogoUrl();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // UI言語
  const { uiLang } = useUILang();
  const t = T[uiLang] ?? T.ja;
  const rtl = uiLang === "ar";

  // 表示対象メニュー（Firestore購読）
  const [visibleMenuKeys, setVisibleMenuKeys] = useState<MenuKey[]>(
    [...MENU_ITEMS, ...FOOTER_ITEMS].map((m) => m.key)
  );
  useEffect(() => {
    const unsub = onSnapshot(META_REF, (snap) => {
      const data = snap.data() as { visibleMenuKeys?: MenuKey[] } | undefined;
      if (Array.isArray(data?.visibleMenuKeys) && data!.visibleMenuKeys.length) {
        setVisibleMenuKeys(data!.visibleMenuKeys);
      }
    });
    return () => unsub();
  }, []);

  // ログイン状態
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => setIsLoggedIn(!!user));
    return () => unsub();
  }, []);

  const gradientClass = gradient
    ? gradient.startsWith("bg-[")
      ? gradient // 単色
      : `bg-gradient-to-b ${gradient}` // グラデーション
    : "bg-gray-100";

  // Sheetが閉じたら3タップ状態をリセット
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

  // Sheet内で3タップ検出
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
        className="text-md text-white text-outline font-bold flex items-center gap-2 py-2 hover:opacity-50"
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
      <nav className={clsx("flex gap-4 ml-auto mr-2", rtl && "flex-row-reverse")}>
        {SNS.map(({ name, href, icon: Icon }) => (
          <a
            key={name}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={name}
            className="text-white hover:text-pink-600 transition"
            onClick={handleMenuClose}
          >
            <Icon size={26} strokeWidth={1.8} />
          </a>
        ))}
      </nav>

      {/* 外部リンク（サイト） */}
      <Link
        href="https://tayotteya.com/"
        className="text-xl text-white font-bold flex items-center gap-2 py-2 hover:opacity-50"
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
              className="w-7 h-7 text-white border-2 border-white"
              aria-label={t.menuTitle}
            >
              <Menu size={26} />
            </Button>
          </SheetTrigger>

          <SheetContent
            side="right"
            dir={rtl ? "rtl" : "ltr"}
            className={clsx(
              "flex flex-col",
              gradient && (gradient.startsWith("bg-[") ? gradient : `bg-gradient-to-b ${gradient}`),
              // Closeボタンのサイズ調整（任意）
              "[&_[data-radix-sheet-close]]:w-10 [&_[data-radix-sheet-close]]:h-10",
              "[&_[data-radix-sheet-close]_svg]:w-6 [&_[data-radix-sheet-close]_svg]:h-6"
            )}
          >
            <SheetHeader className="pt-4 px-4">
              <SheetTitle className="text-center text-xl !text-white text-outline">
                {t.menuTitle}
              </SheetTitle>
            </SheetHeader>

            {/* ▼ このラッパーで3タップ検出 */}
            <div
              className="flex-1 flex flex-col justify-between"
              onPointerDown={handleSecretTap}
            >
              {/* 上段：メニュー（表示/非表示 制御） */}
              <div className="flex-1 flex flex-col justify-center items-center space-y-4 text-center">
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
              <div className="flex flex-col items-center gap-3 px-4 pb-2">
                <UILangFloatingPicker />
              </div>

              {/* 下段：フッターリンク（表示/非表示 + ログイン/3タップ制御） */}
              <div className="px-4 py-6">
                <div className="flex flex-col items-center gap-3">
                  {isLoggedIn &&
                    FOOTER_ITEMS.filter((m) =>
                      ["timeline", "community", "analytics"].includes(m.key) &&
                      visibleMenuKeys.includes(m.key as MenuKey)
                    ).map(({ key, href }) => (
                      <Link
                        key={key}
                        href={href}
                        onClick={handleMenuClose}
                        className="text-center text-lg text-white text-outline"
                      >
                        {t[key as Keys]}
                      </Link>
                    ))}

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





