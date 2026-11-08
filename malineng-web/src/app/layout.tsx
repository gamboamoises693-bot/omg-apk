import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { AlertBanner } from "@/components/AlertBanner";

export const metadata: Metadata = {
  title: "Barangay Malineng | Angeles City, Pampanga",
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
    <html lang="fil">
      <body>
        <Providers>
          <AlertBanner />
          <TopBar />
          <main className="mx-auto min-h-screen max-w-3xl px-4 pb-28 pt-4">{children}</main>
          <BottomNav />
        </Providers>
      </body>
    </html>
  );
}
