import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { AlertBanner } from "@/components/AlertBanner";
import { HeatIndexBanner } from "@/components/HeatIndexBanner";
import { TEXT_SIZE_BOOT_SCRIPT } from "@/lib/textSize";

export const metadata: Metadata = {
  title: "Barangay Malineng | Cuyapo, Nueva Ecija",
  description: "Opisyal na community website ng Barangay Malineng: serbisyo, tindahan, trabaho, ayuda checker at iba pa.",
  manifest: "/manifest.json",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0B5C3F",
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
          <main className="mx-auto min-h-screen max-w-3xl px-4 pb-28 pt-4">{children}</main>
          <BottomNav />
        </Providers>
      </body>
    </html>
  );
}
