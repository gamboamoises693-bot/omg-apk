import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { WebAccessGate } from "@/components/WebAccessGate";
import { EmailVerifyGate } from "@/components/EmailVerifyGate";
import { AlertBanner } from "@/components/AlertBanner";
import { HeatIndexBanner } from "@/components/HeatIndexBanner";
import { TEXT_SIZE_BOOT_SCRIPT } from "@/lib/textSize";

export const metadata: Metadata = {
  title: "Barangay Malineng | Cuyapo, Nueva Ecija",
  description: "Opisyal na community website ng Barangay Malineng: serbisyo, tindahan, trabaho, ayuda checker at iba pa.",
  manifest: "/manifest.json",
  icons: { icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }, { url: "/icon.svg", type: "image/svg+xml" }], apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1F5FAE",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fil" suppressHydrationWarning>
      <head>
        {/* Apply the saved "Aa" text size before first paint. */}
        <script dangerouslySetInnerHTML={{ __html: TEXT_SIZE_BOOT_SCRIPT }} />
      </head>
      <body>
        <Providers>
          <AlertBanner />
          <HeatIndexBanner />
          <TopBar />
          <EmailVerifyGate />
          <main className="mx-auto min-h-screen max-w-3xl px-4 pb-28 pt-4"><WebAccessGate>{children}</WebAccessGate></main>
          <BottomNav />
        </Providers>
      </body>
    </html>
  );
}
