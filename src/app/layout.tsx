import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { getServerLocale } from "@/lib/locale";
import { dir } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "SplitEasy — מחלקים הוצאות בלי כאב ראש",
  description:
    "אפליקציה לשיתוף הוצאות בקבוצה. צרו קבוצה, שתפו קישור, ורשמו הוצאות — בלי הרשמה.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "SplitEasy", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#17b890",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = getServerLocale();
  return (
    <html lang={locale} dir={dir(locale)} suppressHydrationWarning>
      <body>
        <Providers locale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
