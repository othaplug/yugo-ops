import type { NextConfig } from "next";

// Proxy/middleware runs on Edge: only NEXT_PUBLIC_* (and this `env` map) are inlined at
// build time. Map SUPABASE_* → public names so hosting setups that omit NEXT_PUBLIC_*
// still get a working Supabase client in src/proxy.ts.
const supabaseUrlForEdge =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseAnonKeyForEdge =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";

const baseSecurityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), usb=()" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

const nextConfig: NextConfig = {
  reactCompiler: true,
  env: {
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrlForEdge,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKeyForEdge,
  },
  // Never expose source maps to the browser in production
  productionBrowserSourceMaps: false,
  experimental: {
    viewTransition: true,
    /** Avoid HMR “module factory is not available” when barrel-imported Phosphor icons change (e.g. crew job page). */
    optimizePackageImports: ["@phosphor-icons/react"],
  },
  serverExternalPackages: ["square"],
  async headers() {
    return [
      {
        source: "/widget/:path*",
        headers: baseSecurityHeaders,
      },
      {
        source: "/quote-widget/:path*",
        headers: baseSecurityHeaders,
      },
      {
        // Admin and API: strict framing, no indexing, no sniffing
        source: "/admin/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          ...baseSecurityHeaders,
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          ...baseSecurityHeaders,
        ],
      },
      {
        source: "/((?!widget|quote-widget).*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          ...baseSecurityHeaders,
        ],
      },
    ];
  },
};

export default nextConfig;
