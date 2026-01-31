import type { Metadata } from 'next';

export const metadata: Metadata = {
  // 1. "ETF Rotation" and "Relative Strength" are high-intent keywords
  title: 'Momentum Rotation Strategy Backtester | ETF Relative Strength Tool',
  
  // 2. Describe the specific mechanism (switching between assets based on performance)
  description: 'Backtest ETF rotation strategies. Automatically switch between SPY, TLT, GLD, and EEM based on 3-month or 6-month relative strength. Free momentum backtesting tool.',
  
  keywords: [
    'momentum rotation strategy', // Primary
    'ETF rotation backtest',
    'relative strength scanner',
    'dual momentum backtester',
    'asset allocation simulator',
    'sector rotation strategy',
    'tactical asset allocation',
    'monthly rebalancing backtest',
    'gem strategy backtest',
    'trend following etf'
  ],
  alternates: {
    canonical: 'https://finbacktester.com/momentum',
  },
  openGraph: {
    title: 'Free ETF Rotation Backtester | Momentum Strategy',
    description: 'Simulate a portfolio that rotates into the strongest assets each month. Test relative strength strategies on stocks and ETFs.',
    url: 'https://finbacktester.com/momentum',
    siteName: 'FinBacktester',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ETF Momentum Rotation Backtester',
    description: 'Backtest monthly rotation strategies based on relative strength.',
  },
};

export default function MomentumLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}