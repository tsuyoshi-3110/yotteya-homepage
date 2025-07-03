"use client";

import { useState } from "react";
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
import { Instagram } from "lucide-react";

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

export default function Header({ className = "" }: HeaderProps) {
  /* ▼ 追加：Sheet の開閉を管理するステート */
  const [open, setOpen] = useState(false);

  return (
    <header
      className={clsx(
        "fixed top-0 z-30 w-full",
        "flex items-center justify-between px-4 py- text-white bg-gradient-to-b from-[#fe01be] to-[#fadb9f] ",
        className
      )}
      style={{ "--header-h": "4rem" } as React.CSSProperties}
    >
      {/* ロゴ */}
      <Link
        href="/"
        className="text-xl font-bold flex items-center gap-2 py-2  hover:text-pink-600 hover:opacity-50"
      >
        <Image
          src="/images/logo.jpg"
          alt="ロゴ"
          width={48}
          height={48}
          className="w-12 h-auto object-contain transition-opacity duration-200 "
        />
        甘味処 よって屋
      </Link>

      <nav className="flex gap-4 ml-auto mr-6">
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

      {/* スマホハンバーガー */}
      <div>
        {/* open / onOpenChange を指定 */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="w-7 h-7 text-white border-2 border-white " // ← 48 × 48 px
            >
              <Menu size={26} />
            </Button>
          </SheetTrigger>

          <SheetContent
            side="right"
            className="
    bg-gradient-to-b from-[#fe01be] to-[#fadb9f] flex flex-col
    [&_[data-radix-sheet-close]]:w-10 [&_[data-radix-sheet-close]]:h-10
    [&_[data-radix-sheet-close]_svg]:w-6 [&_[data-radix-sheet-close]_svg]:h-6
  "
          >
            <SheetHeader className="pt-4 px-4">
              <SheetTitle className="text-center text-xl text-white">
                メニュー
              </SheetTitle>
            </SheetHeader>

            <div className="flex-1 flex flex-col justify-center items-center space-y-4 text-center">
              {/* onClick で setOpen(false) */}

              <Link
                href="/products"
                onClick={() => setOpen(false)}
                className="text-lg text-white"
              >
                商品一覧
              </Link>
              <Link
                href="/stores"
                onClick={() => setOpen(false)}
                className="text-lg text-white"
              >
                店舗案内
              </Link>
              <Link
                href="/about"
                onClick={() => setOpen(false)}
                className="text-lg text-white"
              >
                当店の思い
              </Link>
              <Link
                href="/news"
                onClick={() => setOpen(false)}
                className="text-lg text-white"
              >
                お知らせ
              </Link>
              <Link
                href="mailto:tsreform.yukisaito@gmail.com"
                className="hover:underline text-white"
              >
                取材はこちら
              </Link>
            </div>
            {/* ▼ ログインだけ下に固定 */}
            <div className="p-4">
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="block text-center text-white text-lg"
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
