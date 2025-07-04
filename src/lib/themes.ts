
export const THEMES = {
  brandA: "from-[rgba(245,75,202,0.7)] to-[rgba(250,219,159,0.7)]",
  brandB: "from-[rgba(100,149,237,0.7)] to-[rgba(144,238,144,0.7)]",
  brandC: "from-[rgba(147,112,219,0.7)] to-[rgba(255,182,193,0.7)]",
  brandD: "from-[rgba(255,165,0,0.7)] to-[rgba(255,99,71,0.7)]",
  brandE: "from-[rgba(64,224,208,0.7)] to-[rgba(173,255,47,0.7)]",
} as const;

export type ThemeKey = keyof typeof THEMES;
