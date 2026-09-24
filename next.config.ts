import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
];

const nextConfig: NextConfig = {
  // Lets several dev servers run side by side (e.g. NEXT_DIST_DIR=.next-e2e).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  devIndicators: false,
  turbopack: { root: process.cwd() },
  // PGlite ships WASM + data files; load it with native require instead of bundling.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Files read from disk at runtime: SQL migrations (automatic setup) and the fonts and images the
  // generated social cards inline.
  outputFileTracingIncludes: {
    "/**": ["./db/migrations/*.sql", "./lib/og/fonts/*.ttf", "./public/brand/*.png", "./public/mentors/*.jpg"],
  },
  async redirects() {
    // The calendar lives at /schedule; /calendar is a friendly alias (query strings pass through).
    return [{ source: "/calendar", destination: "/schedule", permanent: false }];
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/organizers/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
      {
        source: "/organizers",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};

export default nextConfig;
