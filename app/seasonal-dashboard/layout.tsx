import type { Metadata } from 'next';

export const metadata: Metadata = {
  // 1. "Best Stocks to Buy Today" is a high-volume keyword
  title: 'Best Stocks to Buy Today | Historical Seasonality Scanner',
  
  // 2. Focus on "Win Rate" and "Probability" to sound professional
  description: 'Quantitative scanner ranking stocks by historical win rate for the current trading day. See average returns and probability of success based on 20+ years of data.',
  
  keywords: [
    'best stocks to buy today', // High volume
    'stock seasonality scanner',
    'historical stock returns',
    'probability of profit scanner',
    'seasonal trading strategy',
    'market timing tool',
    'quantitative stock picker',
    'daily stock market patterns',
    'swing trading ideas',
    'momentum vs seasonality'
  ],
  alternates: {
    canonical: 'https://finbacktester.com/seasonal-dashboard',
  },
  openGraph: {
    title: 'Best Stocks to Buy Today | Seasonality Scanner',
    description: 'Don\'t guess. See which stocks historically perform best on this specific trading day based on 20 years of data.',
    url: 'https://finbacktester.com/seasonal-dashboard',
    siteName: 'FinBacktester',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Daily Stock Seasonality Scanner',
    description: 'Find the highest probability trades for today based on historical win rates.',
  },
};

export default function SeasonalDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}