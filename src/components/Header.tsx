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
import { sendGAEvent } from "./gtag";

type HeaderProps = {
  className?: string;
};

const SNS = [
  {
    name: "Instagram",
    href: "https://www.instagram.com/yotteya.crape/",
    icon: Instagram,
  },
];

const HEADER_H = "3rem";

export default function Header({ className = "" }: HeaderProps) {
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

  const handleInterviewClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();

    sendGAEvent({
      action: "interview_click",
      category: "engagement",
      label: "取材メールリンク",
    });

    setTimeout(() => {
      window.location.href = "mailto:tsreform.yukisaito@gmail.com";
    }, 800);
  };

  const handleAccessClick = () => {
    sendGAEvent({
      action: "access_click",
      category: "engagement",
      label: "アクセスリンク（Googleマップ）",
    });

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
      >
        {logoUrl && logoUrl.trim() !== "" && (
          <Image
            src={logoUrl}
            alt="ロゴ"
            width={48}
            height={48}
            className="w-12 h-12 object-contain transition-opacity duration-200"
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
          >
            <Icon size={26} strokeWidth={1.8} />
          </a>
        ))}
      </nav>

      <Link
        href="https://tayotteya.com/"
        className="text-xl text-white font-bold flex items-center gap-2 py-2 hover:opacity-50"
      >
        {logoUrl && logoUrl.trim() !== "" && (
          <Image
            src="/images/tayotteya_circle_image.png"
            alt="ロゴ"
            width={32}
            height={32}
            className="w-7 h-7 object-contain transition-opacity duration-200 mr-2"
          />
        )}
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
              <Link href="/products" onClick={() => setOpen(false)} className="text-lg text-white">
                商品一覧
              </Link>
              <Link href="/stores" onClick={handleAccessClick} className="text-lg text-white">
                アクセス
              </Link>
              <Link
                href="https://www.ubereats.com/store/..."
                onClick={() => setOpen(false)}
                className="text-lg text-white"
              >
                デリバリー
              </Link>
              <Link href="/about" onClick={() => setOpen(false)} className="text-lg text-white">
                当店の思い
              </Link>
              <Link href="/news" onClick={() => setOpen(false)} className="text-lg text-white">
                お知らせ
              </Link>
              <a
                href="mailto:tsreform.yukisaito@gmail.com"
                onClick={handleInterviewClick}
                className="hover:underline text-white"
              >
                取材はこちら
              </a>
            </div>

            <div className="p-4 space-y-2">
              {isLoggedIn && (
                <>
                  <Link href="/postList" onClick={() => setOpen(false)} className="block text-center text-lg text-white">
                    タイムライン
                  </Link>
                  <Link href="/community" onClick={() => setOpen(false)} className="block text-center text-lg text-white">
                    コミュニティ
                  </Link>
                </>
              )}
              <Link href="/login" onClick={() => setOpen(false)} className="block text-center text-lg text-white">
                管理者ログイン
              </Link>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
