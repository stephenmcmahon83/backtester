// app/layout.tsx
import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Script from "next/script";
import Navbar from "@/components/Navbar"; // Ensure this path matches where you saved Step 1

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FinBacktester | Quantitative Financial Strategies",
  description: "Data-driven backtesting for trend, mean reversion, and seasonal trading strategies.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX" crossOrigin="anonymous" strategy="afterInteractive" />
      </head>
      <body className={`${inter.className} bg-gray-100 flex flex-col min-h-screen`} suppressHydrationWarning={true}>
        
        {/* Sticky Header with the new Responsive Navbar */}
        <header className="bg-white shadow-md border-b border-gray-200 sticky top-0 z-50">
           <Navbar /> 
        </header>

        <main className="flex-grow w-full">{children}</main>
        
        <footer className="bg-white border-t border-gray-200 mt-auto">
          <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <p className="text-sm text-gray-500">&copy; {new Date().getFullYear()} FinBacktester. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}