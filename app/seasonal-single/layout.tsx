import type { Metadata } from 'next';

export const metadata: Metadata = {
  // 1. "Best Day to Buy" is a specific long-tail query traders use
  title: 'Stock Seasonality Calculator | Best Day to Buy AAPL, NVDA, SPY',
  
  // 2. Explicitly listing tickers helps rank for "NVDA Seasonality", "Tesla Seasonality", etc.
  description: 'Free Stock Seasonality Calculator. Analyze 20+ years of daily patterns for Apple (AAPL), Nvidia (NVDA), Tesla (TSLA), and SPY. Find the best historical trading days.',
  
  keywords: [
    'stock seasonality calculator', // Primary keyword
    'best day to buy apple stock',
    'NVDA seasonal patterns',
    'monthly stock returns history',
    'stock market heat map',
    'AAPL seasonality chart',
    'TSLA historical returns',
    'swing trading calendar',
    'january effect calculator',
    'sell in may indicator'
  ],
  alternates: {
    canonical: 'https://finbacktester.com/seasonal-single',
  },
  openGraph: {
    title: 'Stock Seasonality Calculator | FinBacktester',
    description: 'Find the best day of the year to buy any stock. Analyze 20 years of historical win rates for AAPL, NVDA, TSLA, and more.',
    url: 'https://finbacktester.com/seasonal-single',
    siteName: 'FinBacktester',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Stock Seasonality Calculator',
    description: 'Analyze historical daily patterns for any US stock. Free seasonality heatmap tool.',
  },
};

export default function SeasonalSingleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}