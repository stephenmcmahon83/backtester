import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Seasonality Dashboard - Best Stocks to Buy This Month Based on History',
  description: 'See which stocks have the best historical performance for the current trading day. Stocks ranked by win rate and average returns based on 20+ years of data. Compare trailing momentum with forward seasonal patterns across the entire market.',
  keywords: [
    'best stocks this month',
    'best stocks today',
    'stock seasonality scanner',
    'market seasonality snapshot',
    'seasonal stock picks',
    'stocks with best win rate',
    'trading day patterns',
    'seasonal returns',
    'market timing',
    'stock calendar effects',
    'best performing stocks today',
    'seasonal trading opportunities',
    'stock market calendar',
    'daily stock patterns',
    'market-wide seasonality',
  ],
  alternates: {
    canonical: 'https://finbacktester.com/seasonal-dashboard',
  },
  openGraph: {
    title: 'Seasonality Dashboard - Best Stocks Today | FinBacktester',
    description: 'Which stocks perform best on this trading day historically? See rankings based on 20+ years of data with win rates and average returns.',
    url: 'https://finbacktester.com/seasonal-dashboard',
    siteName: 'FinBacktester',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Seasonality Dashboard | FinBacktester',
    description: 'Find the best seasonal stock opportunities for today. Compare historical performance across the entire market.',
  },
};

export default function SeasonalDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}