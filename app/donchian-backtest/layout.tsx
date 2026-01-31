import type { Metadata } from 'next';

export const metadata: Metadata = {
  // 1. Pivot to "Turtle Trading" - a very high volume keyword
  title: 'Donchian Channel Backtester | Turtle Trading Strategy Simulator',
  
  // 2. "Free" and "Simulator" increase clicks
  description: 'Free simulator for the classic Turtle Trading strategy. Backtest Donchian Channel breakouts (20-day, 50-day) on any stock. Visualize equity curves and drawdowns.',
  
  keywords: [
    'turtle trading simulator', // High value
    'donchian channel backtester',
    'richard dennis strategy',
    'trend following algorithm',
    '20 day breakout strategy',
    '55 day breakout',
    'systematic trading tool',
    'stock trend scanner'
  ],
  alternates: {
    canonical: 'https://finbacktester.com/trend-strategies',
  },
  openGraph: {
    title: 'Turtle Trading Strategy Simulator',
    description: 'Test the legendary Turtle Trader rules on modern stocks. Free Donchian Channel backtester.',
    url: 'https://finbacktester.com/trend-strategies',
    siteName: 'FinBacktester',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Turtle Trading Simulator | FinBacktester',
    description: 'Backtest the famous Donchian Channel breakout strategy on any stock.',
  },
};

export default function TrendStrategiesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}