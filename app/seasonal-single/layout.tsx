import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Stock Seasonality by Month - Historical Monthly Performance Analysis',
  description: 'Analyze any stock\'s historical performance by trading day of the year over 20+ years. See which days have the highest win rates and average returns. Discover seasonal patterns for AAPL, MSFT, NVDA, SPY, QQQ, and 100+ stocks. Exploit calendar effects and recurring market patterns.',
  keywords: [
    'stock seasonality',
    'stock seasonality by month',
    'stock seasonality by day',
    'best day to buy stocks',
    'stock daily returns',
    'AAPL seasonality',
    'SPY seasonality',
    'NVDA seasonality',
    'January effect stocks',
    'sell in May go away',
    'Santa Claus rally',
    'stock calendar patterns',
    'seasonal stock trading',
    'trading day patterns',
    'daily stock performance history',
    'best performing days stocks',
    'worst days for stocks',
    'calendar effects',
    'stock market anomalies',
  ],
  alternates: {
    canonical: 'https://finbacktester.com/seasonal-single',
  },
  openGraph: {
    title: 'Stock Seasonality by Trading Day | FinBacktester',
    description: 'Which trading days are best for buying stocks? Analyze 20+ years of historical daily performance for any stock. Free seasonality tool.',
    url: 'https://finbacktester.com/seasonal-single',
    siteName: 'FinBacktester',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Stock Seasonality Analysis | FinBacktester',
    description: 'Discover seasonal patterns in any stock. See historical win rates and returns by trading day of year.',
  },
};

export default function SeasonalSingleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}