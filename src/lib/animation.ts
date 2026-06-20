// src/lib/animations.ts

import type { Transition } from "framer-motion";

export const transition: Record<"slow" | "normal" | "fast", Transition> = {
  slow:   { duration: 0.6, ease: [0.16, 1, 0.3, 1] },  // 0.8 → 0.6
  normal: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },  // 0.45 → 0.3
  fast:   { duration: 0.18, ease: [0.16, 1, 0.3, 1] }, // 0.25 → 0.18
};

export const animations = {
  fadeInUp: {
    initial: { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
  },
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
  },
  scaleFade: {
    initial: { opacity: 0, scale: 0.92 },
    animate: { opacity: 1, scale: 1 },
  },
};
