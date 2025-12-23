// app/layout.tsx

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import Script from "next/script";

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
        <header className="bg-white shadow-md border-b border-gray-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <nav className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center">
                <Link href="/" className="group flex items-center gap-2">
                  <div className="text-indigo-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <span className="text-xl font-extrabold tracking-tight text-gray-900 group-hover:text-indigo-600 transition-colors">Fin<span className="text-indigo-600">Backtester</span></span>
                </Link>
              </div>
              <div className="flex flex-wrap justify-center items-center gap-1 md:gap-2">
                {/* --- ADDED: Home Link --- */}
                <Link href="/" className="text-gray-700 hover:text-indigo-600 hover:bg-indigo-50 px-3 py-2 rounded-md text-sm font-semibold transition-colors">Home</Link>
                <div className="hidden md:block w-px h-6 bg-gray-300"></div>
                <div className="relative group">
                  <button className="text-gray-700 hover:text-indigo-600 hover:bg-indigo-50 px-3 py-2 rounded-md text-sm font-semibold transition-colors flex items-center gap-1">Single Stock Backtesting <span className="text-xs">▼</span></button>
                  <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 w-56 bg-white border border-gray-200 rounded-md shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                    <Link href="/trend-strategies" className="block px-4 py-3 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 border-b border-gray-100">Trend Strategies</Link>
                    <Link href="/connors-strategies" className="block px-4 py-3 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600">Mean-Reversion Strategies</Link>
                  </div>
                </div>
                <div className="relative group">
                  <button className="text-gray-700 hover:text-indigo-600 hover:bg-indigo-50 px-3 py-2 rounded-md text-sm font-semibold transition-colors flex items-center gap-1">Portfolio Backtesting <span className="text-xs">▼</span></button>
                  <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 w-64 bg-white border border-gray-200 rounded-md shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                    <Link href="/portfolio-momentum" className="block px-4 py-3 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600">Monthly Momentum Rotation</Link>
                  </div>
                </div>
                <div className="relative group">
                  <button className="text-gray-700 hover:text-indigo-600 hover:bg-indigo-50 px-3 py-2 rounded-md text-sm font-semibold transition-colors flex items-center gap-1">Seasonality <span className="text-xs">▼</span></button>
                  <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 w-64 bg-white border border-gray-200 rounded-md shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                    <Link href="/seasonal-single" className="block px-4 py-3 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 border-b border-gray-100">Single Stock/ETF - Full Year</Link>
                    <Link href="/seasonal-dashboard" className="block px-4 py-3 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600">All Stocks/ETFs - Current</Link>
                  </div>
                </div>
                <div className="hidden md:block w-px h-6 bg-gray-300 mx-2"></div>
                <div className="flex gap-1">
                  <Link href="/about" className="text-gray-500 hover:text-indigo-600 px-3 py-2 rounded-md text-sm font-medium transition-colors">About</Link>
                  <Link href="/disclaimer" className="text-gray-500 hover:text-indigo-600 px-3 py-2 rounded-md text-sm font-medium transition-colors">Disclaimer</Link>
                </div>
              </div>
            </nav>
          </div>
        </header>
        <main className="flex-grow w-full">{children}</main>
        <footer className="bg-white border-t border-gray-200 mt-auto">
          <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <p className="text-sm text-gray-500">&copy; {new Date().getFullYear()} FinBacktester. All rights reserved.</p>
              <div className="text-xs text-gray-400 mt-2 md:mt-0">Powered by Outlier Generative AI</div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}