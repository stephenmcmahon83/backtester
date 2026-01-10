import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Stock Streak Analyzer - What Happens After Winning & Losing Streaks',
  description: 'Backtest what happens after stocks go on winning or losing streaks. Do stocks continue higher after 3, 4, 5+ consecutive up days? Do oversold stocks bounce after 5+ down days? See historical data, win rates, and average returns for any stock.',
  keywords: [
    'stock winning streak',
    'stock losing streak',
    'consecutive up days stocks',
    'consecutive down days stocks',
    'stock streak analysis',
    'stock streak backtest',
    'winning streak trading',
    'losing streak bounce',
    'mean reversion streaks',
    '5 day winning streak',
    '5 day losing streak',
    'stocks after down days',
    'does momentum continue',
    'streak trading strategy',
    'consecutive days strategy',
    'stock pattern analysis',
    'trading after streaks',
  ],
  alternates: {
    canonical: 'https://finbacktester.com/streaks-single',
  },
  openGraph: {
    title: 'Stock Streak Analyzer - After Winning & Losing Streaks | FinBacktester',
    description: 'What happens after a stock has 3, 4, 5+ consecutive up or down days? Backtest streak patterns on any stock with historical win rates and average returns.',
    url: 'https://finbacktester.com/streaks-single',
    siteName: 'FinBacktester',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Stock Streak Analyzer | FinBacktester',
    description: 'What happens after a stock has 5+ up or down days in a row? Backtest streak patterns for free.',
  },
};

export default function StreaksSingleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}