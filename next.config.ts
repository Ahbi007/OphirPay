import type { NextConfig } from "next";

// NOTE: the Content-Security-Policy is set per-request in src/proxy.ts.
// Next 16 renamed the `middleware` convention to `proxy`, so there is no
// middleware file to look for. src/proxy.ts builds the policy in buildCsp()
// and keeps 'unsafe-inline' in script-src because this Next build does not
// propagate a per-request nonce to the App Router renderer — a nonce-based
// script-src would block Next's inline streaming/hydration scripts and the
// app would never hydrate. A static CSP here cannot express the per-request
// policy (and would not carry a nonce either), so it must NOT live here.

const nextConfig: NextConfig = {
  // Standalone output — required by the Docker image (copies .next/standalone).
  // Disabled on Vercel: Next 16.3's adapter-based Vercel builds crash with
  // ENOENT .next/next-server.js.nft.json when standalone is set (vercel/next.js
  // #96646 / #96657), and Vercel doesn't use the standalone folder anyway.
  output: process.env.VERCEL ? undefined : "standalone",

  // Note: instrumentation (src/instrumentation.ts) is always enabled in Next.js 16
  // — the legacy `instrumentationHook` option was removed from the config type.

  // Power web vitals with edge performance metrics
  poweredByHeader: false,

  // Compress responses for better performance
  compress: true,

  // Production source maps disabled for security
  productionBrowserSourceMaps: false,

  // Security headers applied to all responses
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-XSS-Protection", value: "0" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
      ],
    },
    {
      source: "/api/(.*)",
      headers: [
        { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
      ],
    },
  ],

  // Image optimization for Stellar Explorer and other external sources
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "stellar.expert" },
      { protocol: "https", hostname: "raw.githubusercontent.com" },
    ],
  },
};

export default nextConfig;
