// components/common/Header.tsx
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
import { useHeaderLogoUrl } from "../../hooks/useHeaderLogoUrl";
import { auth, db } from "@/lib/firebase";
import UILangFloatingPicker from "../UILangFloatingPicker";
import { useUILang, type UILang as UILangType } from "@/lib/atoms/uiLangAtom";
import { doc, onSnapshot } from "firebase/firestore";
import { SITE_KEY } from "@/lib/atoms/siteKeyAtom";
import { ThemeKey, THEMES } from "@/lib/themes";

/* Firestore: メニュー表示制御 & i18n */
const META_REF = doc(db, "siteSettingsEditable", SITE_KEY);

/* i18n 辞書 */
type Keys =
  | "menuTitle"
  | "home"
  | "products"
  | "stores"
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
    home: "ホーム",
    products: "商品一覧",
    stores: "店舗一覧",
    about: "私たちの思い",
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
    home: "Home",
    products: "Products",
    stores: "Access",
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
    home: "首页",
    products: "商品一览",
    stores: "交通/访问",
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
    home: "首頁",
    products: "商品一覽",
    stores: "交通/位置",
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
    home: "홈",
    products: "상품 목록",
    stores: "오시는 길",
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
    home: "Accueil",
    products: "Produits",
    stores: "Accès",
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
    home: "Inicio",
    products: "Productos",
    stores: "Acceso",
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
    home: "Startseite",
    products: "Produkte",
    stores: "Anfahrt",
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
    home: "Início",
    products: "Produtos",
    stores: "Acesso",
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
    home: "Home",
    products: "Prodotti",
    stores: "Accesso",
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
    home: "Главная",
    products: "Товары",
    stores: "Как добраться",
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
    home: "หน้าแรก",
    products: "รายการสินค้า",
    stores: "การเดินทาง",
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
    home: "Trang chủ",
    products: "Danh mục",
    stores: "Đường đi",
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
    home: "Beranda",
    products: "Daftar produk",
    stores: "Akses",
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
    home: "होम",
    products: "उत्पाद सूची",
    stores: "पहुँच",
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
    home: "الصفحة الرئيسية",
    products: "قائمة المنتجات",
    stores: "الوصول",
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

/* メニュー定義 */
type MenuKey =
  | "products"
  | "home"
  | "stores"
  | "about"
  | "company"
  | "news"
  | "interview"
  | "timeline"
  | "community"
  | "analytics"
  | "admin";

type MenuItem = { key: MenuKey; href: string; external?: boolean };

const MENU_ITEMS: MenuItem[] = [
  { key: "home", href: "/" },
  { key: "products", href: "/products" },
  { key: "stores", href: "/stores" },
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

/* レイアウト用 */
const HEADER_H = "3rem";
const TRIPLE_TAP_INTERVAL_MS = 500;
const IGNORE_SELECTOR = "a,button,input,select,textarea,[role='button']";

export default function Header({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const gradient = useThemeGradient();
  const logoUrl = useHeaderLogoUrl();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // 現在の UI 言語（グローバル）
  const { uiLang } = useUILang();

  // Firestore: 表示メニュー
  const [visibleMenuKeys, setVisibleMenuKeys] = useState<MenuKey[]>(
    [...MENU_ITEMS, ...FOOTER_ITEMS].map((m) => m.key)
  );

  // Firestore: i18n 設定（ON/OFF と許可言語）
  const [i18nEnabled, setI18nEnabled] = useState<boolean>(true);
  const [allowedLangs, setAllowedLangs] = useState<UILangType[] | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(META_REF, (snap) => {
      const data = snap.data() as
        | {
            visibleMenuKeys?: MenuKey[];
            i18n?: { enabled?: boolean; langs?: UILangType[] };
          }
        | undefined;

      if (Array.isArray(data?.visibleMenuKeys) && data!.visibleMenuKeys!.length) {
        setVisibleMenuKeys(data!.visibleMenuKeys!);
      }

      const enabled =
        typeof data?.i18n?.enabled === "boolean" ? (data!.i18n!.enabled as boolean) : true;
      setI18nEnabled(enabled);

      // 未設定時は ja のみ、常に ja は含める
      const langs = Array.isArray(data?.i18n?.langs)
        ? (data!.i18n!.langs as UILangType[])
        : (["ja"] as UILangType[]);
      const set = new Set<UILangType>(langs);
      set.add("ja" as UILangType);
      setAllowedLangs(Array.from(set));
    });
    return () => unsub();
  }, []);

  /* ログイン状態 */
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => setIsLoggedIn(!!u));
    return () => unsub();
  }, []);

  /* グラデーション */
  const gradientClass = gradient
    ? gradient.startsWith("bg-[")
      ? gradient
      : `bg-gradient-to-b ${gradient}`
    : "bg-gray-100";

  /* ダークテーマ判定（ボタンの枠色に使用） */
  const isDark = useMemo(() => {
    const darkKeys: ThemeKey[] = ["brandG", "brandH", "brandI"];
    if (!gradient) return false;
    return darkKeys.some((k) => gradient === THEMES[k]);
  }, [gradient]);

  /* ───────── i18n: 実際に使う言語（翻訳OFF時や許可外は日本語にフォールバック） ───────── */
  const effectiveLang: UILangType = useMemo(() => {
    const allow = new Set<UILangType>(
      i18nEnabled ? (allowedLangs ?? (["ja"] as UILangType[])) : (["ja"] as UILangType[])
    );
    if (allow.has(uiLang)) return uiLang;
    return allow.has("ja" as UILangType)
      ? ("ja" as UILangType)
      : (Array.from(allow)[0] as UILangType);
  }, [i18nEnabled, allowedLangs, uiLang]);

  const t = T[effectiveLang] ?? T.ja;
  const rtl = effectiveLang === "ar";

  /* 管理者リンクの3タップ */
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

  // 言語ピッカーを表示する条件（ON かつ 許可言語 > 1）
  const showLangPicker =
    i18nEnabled &&
    Array.isArray(allowedLangs) &&
    new Set<UILangType>(allowedLangs).size > 1;

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
          "text-white text-outline"
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

          {/* === シート === */}
           <SheetContent
            side="right"
            className={clsx(
              "flex h-dvh min-h-0 flex-col p-0",
              gradient && "bg-gradient-to-b",
              gradient || "bg-gray-100",
              // ▼ 色切替 + 線を太く + アイコンサイズを拡大（例: 28px）
              isDark
                ? "[&>button]:text-white [&>button>svg]:!text-white [&>button>svg]:stroke-[3] [&>button>svg]:w-7 [&>button>svg]:h-6"
                : "[&>button]:text-black [&>button>svg]:!text-black [&>button>svg]:stroke-[3] [&>button>svg]:w-7 [&>button>svg]:h-6"
            )}
            dir={rtl ? "rtl" : "ltr"}
          >
            {/* 先頭固定ヘッダー */}
            <SheetHeader className="px-6 py-4 border-b border-white/30">
              <SheetTitle className="text-white text-outline text-xl">
                {t.menuTitle}
              </SheetTitle>
            </SheetHeader>

            {/* 中央：上下センター配置のスクロール領域 */}
            <div
              className="flex-1 min-h-0 overflow-y-auto [scrollbar-width:thin] px-6"
              onPointerDown={handleSecretTap}
            >
              <div className="min-h-full flex items-center justify-center">
                <div className="w-full">
                  <nav className="py-4 flex flex-col items-center text-center space-y-3">
                    {MENU_ITEMS.filter((m) =>
                      visibleMenuKeys.includes(m.key)
                    ).map(({ key, href, external }) =>
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
                  </nav>

                  {/* 言語ピッカー（ON かつ複数言語のときだけ表示） */}
                  {showLangPicker && (
                    <div className="flex flex-col items-center gap-2 pb-6">
                      <UILangFloatingPicker />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 下詰めフッター */}
            <div className="border-t border-white/30 px-6 py-4">
              <div className="flex flex-col items-center gap-2">
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
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
