import "./globals.css";
import { ToastProvider } from "@/app/admin/components/Toast";
import { AppNavigationChrome } from "@/components/providers/AppNavigationChrome";
import OfflineBanner from "@/components/ui/OfflineBanner";
import PhosphorProvider from "@/components/ui/PhosphorProvider";
import { getConfig } from "@/lib/config";
import { DISPLAY_DATE_LOCALE_CONFIG_KEY } from "@/lib/display-date-locale";
import {
  DISPLAY_DATE_FORMAT_CONFIG_KEY,
  normalizeDisplayDateFormatPreset,
  resolveStoredDateFormat,
} from "@/lib/display-date-format";

export const metadata = {
  title: { default: "Yugo", template: "%s | Yugo" },
  description: "Premium logistics operations platform",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Yugo",
  },
  icons: {
    icon: [{ url: "/icon.png", type: "image/png" }],
    apple: "/icon.png",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const formatRaw = await getConfig(DISPLAY_DATE_FORMAT_CONFIG_KEY, "");
  const legacyLocaleRaw = await getConfig(DISPLAY_DATE_LOCALE_CONFIG_KEY, "en-US");
  const displayDateFormat = normalizeDisplayDateFormatPreset(
    resolveStoredDateFormat(formatRaw, legacyLocaleRaw),
  );
  const formatJson = JSON.stringify(displayDateFormat);
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{window.__YUGO_DISPLAY_DATE_FORMAT__=${formatJson};}catch(e){}`,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=Instrument+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700&family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <AppNavigationChrome />
        <OfflineBanner />
        <ToastProvider>
          <PhosphorProvider>{children}</PhosphorProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
