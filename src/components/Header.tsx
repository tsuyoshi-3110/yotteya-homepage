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

      {/* PCナビ */}
      <nav className="hidden lg:flex space-x-6">
        <Link href="/products" className="hover:underline">
          商品を見る
        </Link>
        <Link href="/stores" className="hover:underline">
          店舗案内
        </Link>
        <Link
          href="mailto:tsreform.yukisaito@gmail.com"
          className="hover:underline"
        >
          取材はこちら
        </Link>
        <Link href="/login" className="hover:underline">
          管理者ログイン
        </Link>
      </nav>

      {/* スマホハンバーガー */}
      <div className="lg:hidden">
        {/* open / onOpenChange を指定 */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              variant="default"
              size="icon"
              className="bg-white text-pink-500"
            >
              <Menu size={24} />
            </Button>
          </SheetTrigger>

          <SheetContent
            side="right"
            className="bg-gradient-to-b from-[#fe01be] to-[#fadb9f] flex flex-col"
          >
            <SheetHeader className="pt-4 px-4">
              <SheetTitle className="text-center">メニュー</SheetTitle>
            </SheetHeader>

            <div className="flex-1 flex flex-col justify-center items-center space-y-4 text-center">
              {/* onClick で setOpen(false) */}

              <Link
                href="/products"
                onClick={() => setOpen(false)}
                className="text-lg text-white"
              >
                商品を見る
              </Link>
              <Link
                href="/stores"
                onClick={() => setOpen(false)}
                className="text-lg text-white"
              >
                店舗案内
              </Link>
              <Link
                href="mailto:tsreform.yukisaito@gmail.com"
                className="hover:underline"
              >
                取材はこちら
              </Link>
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className=" text-lg text-white"
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
