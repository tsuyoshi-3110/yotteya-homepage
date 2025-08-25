"use client";

import { useEffect, useState } from "react";
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
import { auth } from "@/lib/firebase";

const SNS = [
  {
    name: "Instagram",
    href: "https://www.instagram.com/yotteya.crape/",
    icon: Instagram,
  },
];

const HEADER_H = "3rem";

export default function Header({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const gradient = useThemeGradient();
  const logoUrl = useHeaderLogoUrl();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setIsLoggedIn(!!user);
    });
    return () => unsubscribe();
  }, []);

  const handleMenuClose = () => {
    setOpen(false);
  };

  const gradientClass = gradient
    ? `bg-gradient-to-b ${gradient}`
    : "bg-gray-100";

  return (
    <header
      className={clsx(
        "sticky top-0 z-30 flex items-center justify-between px-4 h-12",
        gradientClass,
        className
      )}
      style={{ "--header-h": HEADER_H } as React.CSSProperties}
    >
      <Link
        href="/"
        className="text-[18px] text-white font-bold flex items-center gap-2 py-2 hover:opacity-50"
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

      <nav className="flex gap-4 ml-auto mr-2">
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

      <Link
        href="https://tayotteya.com/"
        className="text-xl text-white font-bold flex items-center gap-2 py-2 hover:opacity-50"
        onClick={handleMenuClose}
      >
        <Image
          src="/images/tayotteya_circle_image.png"
          alt="ロゴ"
          width={32}
          height={32}
          className="w-7 h-7 object-contain transition-opacity duration-200 mr-2"
          unoptimized
        />
      </Link>

      <div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="w-7 h-7 text-white border-2 border-white"
            >
              <Menu size={26} />
            </Button>
          </SheetTrigger>

          <SheetContent
            side="right"
            className={clsx(
              "flex flex-col bg-gray-100",
              gradient && "bg-gradient-to-b",
              gradient,
              "[&_[data-radix-sheet-close]]:w-10 [&_[data-radix-sheet-close]]:h-10",
              "[&_[data-radix-sheet-close]_svg]:w-6 [&_[data-radix-sheet-close]_svg]:h-6"
            )}
          >
            <SheetHeader className="pt-4 px-4">
              <SheetTitle className="text-center text-xl text-white">
                メニュー
              </SheetTitle>
            </SheetHeader>

            <div className="flex-1 flex flex-col justify-center items-center space-y-4 text-center">
              <Link
                href="/products"
                onClick={handleMenuClose}
                className="text-lg text-white"
              >
                商品一覧
              </Link>
              <Link
                href="/stores"
                onClick={handleMenuClose}
                className="text-lg text-white"
              >
                アクセス
              </Link>
              <Link
                href="https://www.ubereats.com/store/%E3%81%97%E3%82%85%E3%82%8F%E3%81%A3%E3%81%A8%E8%B4%85%E6%B2%A2%E3%83%8F%E3%82%BF%E3%83%BC%E3%81%AE%E3%82%84%E3%81%BF%E3%81%A4%E3%81%8D%E3%82%AF%E3%83%AC%E3%83%BC%E3%83%95-%E3%82%88%E3%81%A3%E3%81%A6%E5%B1%8B/ycwuMM91VIaoNcZ1oCr_5g?diningMode=DELIVERY"
                onClick={handleMenuClose}
                className="text-lg text-white"
              >
                デリバリー
              </Link>
              <Link
                href="/about"
                onClick={handleMenuClose}
                className="text-lg text-white"
              >
                当店の思い
              </Link>
              <Link
                href="/news"
                onClick={handleMenuClose}
                className="text-lg text-white"
              >
                お知らせ
              </Link>
              <a
                href="mailto:tsreform.yokisaito@gmail.com"
                onClick={handleMenuClose}
                className="text-white hover:underline bg-transparent hover:bg-white/10 transition inline-block px-4 py-2 rounded"
              >
                取材はこちら
              </a>
            </div>

            <div className="p-4 space-y-2">
              {isLoggedIn && (
                <>
                  <Link
                    href="/postList"
                    onClick={handleMenuClose}
                    className="block text-center text-lg text-white"
                  >
                    タイムライン
                  </Link>
                  <Link
                    href="/community"
                    onClick={handleMenuClose}
                    className="block text-center text-lg text-white"
                  >
                    コミュニティ
                  </Link>
                  <Link
                    href="/analytics"
                    onClick={handleMenuClose}
                    className="block text-center text-lg text-white"
                  >
                    分析
                  </Link>
                </>
              )}
              <Link
                href="/login"
                onClick={handleMenuClose}
                className="block text-center text-lg text-white"
              >
                管理者ログイン
              </Link>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
