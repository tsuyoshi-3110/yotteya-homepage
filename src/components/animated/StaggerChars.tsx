"use client";

import { motion, Variants, Transition } from "framer-motion";

// Apple / Stripe 系の“減速が美しい”カーブ
const LUXURY_EASE: Transition["ease"] = [0.22, 1, 0.36, 1];

export function StaggerChars({
  text,
  className,
  delay = 0.35,
  stagger = 0.14,
  duration = 1.6,
}: {
  text: string;
  className?: string;
  delay?: number;
  stagger?: number;
  duration?: number;
}) {
  const container: Variants = {
    hidden: { opacity: 1 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: stagger,
        delayChildren: delay,
      },
    },
  };

  const child: Variants = {
    hidden: {
      opacity: 0,
      y: 2,                 // 動きは極小
      filter: "blur(4px)",  // 空気感の正体
    },
    show: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: {
        duration,
        ease: LUXURY_EASE,
      },
    },
  };

  return (
    <motion.span
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.7 }}
      className={className}
    >
      {Array.from(text).map((ch, i) => (
        <motion.span
          key={i}
          variants={child}
          className={`${className} inline-block`}
        >
          {ch === " " ? "\u00A0" : ch}
        </motion.span>
      ))}
    </motion.span>
  );
}
