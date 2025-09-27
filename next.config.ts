// next.config.ts
import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const stripe = [
  "https://js.stripe.com",
  "https://api.stripe.com",
  "https://checkout.stripe.com",
  "https://hooks.stripe.com",
  "https://m.stripe.network",
  "https://r.stripe.com",
];

const firebase = [
  "https://identitytoolkit.googleapis.com",
  "https://securetoken.googleapis.com",
  "https://firestore.googleapis.com",
  "https://firebasestorage.googleapis.com",
  "https://www.googleapis.com",
  "https://www.gstatic.com",
];

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${stripe.join(" ")}`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob: ${stripe.join(" ")}`,
  `frame-src ${stripe.join(" ")}`,
  `connect-src 'self' ${[...stripe, ...firebase].join(" ")}`,
  `font-src 'self' data:`,
  `worker-src 'self' blob:`,
  `form-action 'self' https://checkout.stripe.com https://hooks.stripe.com`,
  `base-uri 'self'`,
  `frame-ancestors 'self'`,
].join("; ");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "firebasestorage.googleapis.com", pathname: "/v0/b/**" },
      { protocol: "https", hostname: "**.firebasestorage.app", pathname: "/**" },
    ],
  },
  async headers() {
    if (!isProd) return []; // ← devはCSPを付けない（今回の方針）
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "SAMEORIGIN" }, // 互換用
        ],
      },
    ];
  },
};

export default nextConfig;
