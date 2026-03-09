import type { NextConfig } from "next";

const baseSecurityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), usb=()" },
];

const nextConfig: NextConfig = {
  reactCompiler: true,
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
