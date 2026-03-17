import type { NextConfig } from "next";

const baseSecurityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), usb=()" },
  // Prevent browsers from revealing source file paths in error messages
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Stop search engines / scrapers from indexing admin paths
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Never expose source maps to the browser in production
  productionBrowserSourceMaps: false,
  experimental: {
    viewTransition: true,
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
