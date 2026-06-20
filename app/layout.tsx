import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/layout/BottomNav";
import { Sidebar } from "@/components/layout/Sidebar";
import { DesktopHeader } from "@/components/layout/DesktopHeader";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AnchurPOS",
  description: "POS ringan untuk bisnis churros",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#16a34a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className={inter.className}>
        {/* Desktop: sidebar + content */}
        <div className="hidden lg:flex h-screen overflow-hidden">
          <Sidebar />
          <div className="flex-1 flex flex-col overflow-hidden">
            <DesktopHeader />
            <main className="flex-1 overflow-auto bg-stone-50">
              {children}
            </main>
          </div>
        </div>
        {/* Mobile: full screen + bottom nav */}
        <div className="lg:hidden min-h-screen bg-stone-50">
          {children}
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
