"use client";

import Link from "next/link";
import clsx from "clsx";
import { Button } from "@/components/ui/button";
import { useBtnClassName } from "@/lib/useBtnClassName";

type Props = {
  href?: string;
  label?: string;
  className?: string;
};

export default function ScrollUpCTA({
  href = "/contact",
  label = "無料相談・お問い合わせ",
  className,
}: Props) {
  const btnClass = useBtnClassName();

  return (
    <div className={clsx(className)}>
      <Link href={href} prefetch className="block">
        <Button className={clsx(btnClass, "h-12 w-full px-5 rounded-2xl shadow-2xl font-bold")}>
          {label}
        </Button>
      </Link>
    </div>
  );
}
