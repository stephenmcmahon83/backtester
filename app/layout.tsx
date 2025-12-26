import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import Navbar from "@/components/Navbar";
import Link from "next/link"; 

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FinBacktester | Quantitative Financial Strategies",
  description:
    "Data-driven backtesting for trend, mean reversion, and seasonal trading strategies.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* ✅ Google AdSense */}
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />

        {/* ✅ Google Analytics 4 */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-ZHMTEDND11"
          strategy="afterInteractive"
        />
        <Script id="ga-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-ZHMTEDND11', {
              anonymize_ip: true,
            });
          `}
        </Script>
      </head>

      <body
        className={`${inter.className} bg-gray-100 flex flex-col min-h-screen`}
        suppressHydrationWarning
      >
        <header className="bg-white shadow-md border-b border-gray-200 sticky top-0 z-50">
          <Navbar />
        </header>

        <main className="flex-grow w-full">{children}</main>

        <footer className="bg-white border-t border-gray-200 mt-auto">
          <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-sm text-gray-500">
                &copy; {new Date().getFullYear()} FinBacktester. All rights
                reserved.
              </p>
              <div className="flex gap-6 text-sm">
                <Link href="/privacy-policy" className="text-gray-500 hover:text-indigo-600 transition-colors">
                  Privacy Policy
                </Link>
                <Link href="/disclaimer" className="text-gray-500 hover:text-indigo-600 transition-colors">
                  Disclaimer
                </Link>
              </div>
            </div>
          </div>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}