"use client";

import { copy, site } from "@/config/site";
import { useUILang } from "@/lib/atoms/uiLangAtom";
import { useSiteKey } from "@/lib/atoms/siteKeyAtom";
import { motion, type Variants, type Transition } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function HomePageText() {
  const { uiLang } = useUILang();
  const siteKey = useSiteKey();
  const bundle = copy[uiLang] ?? copy["ja"];

  const [headline, setHeadline] = useState(bundle.home.headline || site.name);
  const description = bundle.home.description || "";

  useEffect(() => {
    getDoc(doc(db, "siteSettings", siteKey)).then((snap) => {
      const name = snap.data()?.siteName as string | undefined;
      if (name) setHeadline(name);
    });
  }, [siteKey]);

  // ★ スクロール検知
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.2,
  });

  // 同じEASEカーブ採用
  const EASE: Transition["ease"] = [0.16, 1, 0.3, 1];

  // ====== 共通 Stagger コンポーネント ======
  function StaggerText({
    text,
    className,
    as = "p",
    delay = 0.2,
    duration = 0.7,
    stagger = 0.035,
  }: {
    text: string;
    className?: string;
    as?: "h1" | "p";
    delay?: number;
    duration?: number;
    stagger?: number;
  }) {
    const parent: Variants = {
      hidden: {},
      show: { transition: { staggerChildren: stagger, delayChildren: delay } },
    };

    const child: Variants = {
      hidden: { opacity: 0, y: 8 },
      show: {
        opacity: 1,
        y: 0,
        transition: { duration, ease: EASE },
      },
    };

    const MotionTag = as === "h1" ? motion.h1 : motion.p;

    return (
      <MotionTag
        variants={parent}
        initial="hidden"
        animate={inView ? "show" : "hidden"}
        className={className}
      >
        {Array.from(text).map((ch, i) => (
          <motion.span key={i} variants={child} className="inline-block">
            {ch === " " ? "\u00A0" : ch}
          </motion.span>
        ))}
      </MotionTag>
    );
  }

  return (
    <div ref={ref} className="flex flex-col items-center text-center space-y-6 bg-white/30 backdrop-blur-md rounded-3xl shadow-2xl border border-white/50 px-8 py-10 max-w-2xl mx-auto">

      {/* ======= 見出し（1文字ずつ Stagger） ======= */}
      <StaggerText
        text={headline}
        as="h1"
        className="text-3xl lg:text-4xl font-extrabold leading-tight text-white text-outline"
        stagger={0.05}
        duration={0.7}
        delay={0.1}
      />

      {/* ======= 説明文（自然に遅れて出る） ======= */}
      {description && (
        <StaggerText
          text={description}
          className="max-w-3xl text-sm md:text-lg opacity-80 leading-relaxed text-black"
          delay={0.3}
          stagger={0.02}
          duration={0.5}
        />
      )}
    </div>
  );
}
