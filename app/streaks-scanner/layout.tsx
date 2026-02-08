import type { Metadata } from 'next';

export const metadata: Metadata = {
  // 1. "Mean Reversion" and "Winning Streak" are high-intent keywords
  title: 'Stock Winning/Losing Streak Backtester | Mean Reversion Tool',
  
  // 2. Ask the specific questions traders type into Google
  description: 'What happens after AAPL drops 3 days in a row? Do stocks bounce after 5 down days? Backtest winning and losing streak probabilities for any US stock.',
  
  keywords: [
    'winning streak scanner', // Primary
    'losing streak buy the dip',
    'stock mean reversion stats',
    '3 day drop rule',
    'consecutive up days probability',
    'overbought oversold scanner',
    'shorting parabolic stocks',
    'momentum trading simulator',
    'buy the dip backtest',
    'knife catching strategy'
  ],
  alternates: {
    canonical: 'https://finbacktester.com/streaks-scanner',
  },
  openGraph: {
    title: 'Stock Streak Backtester | Winning & Losing Streaks',
    description: 'See the historical win rate of buying a stock after 3, 5, or 10 consecutive down days. Free Mean Reversion Tool.',
    url: 'https://finbacktester.com/streaks-scanner',
    siteName: 'FinBacktester',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Stock Streak Backtester',
    description: 'Backtest mean reversion strategies on winning and losing streaks.',
  },
};

export default function StreaksSingleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}