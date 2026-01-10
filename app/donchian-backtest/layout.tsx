import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Donchian Channel Backtester - Trend Following & Breakout Strategy',
  description: 'Backtest the classic Donchian Channel breakout strategy on any stock. Test different entry and exit periods used by the legendary Turtle Traders. Compare trend-following performance against buy and hold with detailed equity curves, drawdown analysis, and complete trade logs.',
  keywords: [
    'Donchian channel strategy',
    'Donchian channel backtest',
    'Donchian breakout',
    '20 day Donchian',
    '50 day Donchian',
    '55 day Donchian',
    'turtle trading strategy',
    'turtle traders',
    'trend following strategy',
    'trend following backtest',
    'breakout trading strategy',
    'channel breakout backtest',
    'moving average backtest',
    'trend trading system',
    'systematic trading',
    'trading strategy backtester',
    'stock breakout scanner',
  ],
  alternates: {
    canonical: 'https://finbacktester.com/trend-strategies',
  },
  openGraph: {
    title: 'Donchian Channel Backtester - Trend Following Strategy | FinBacktester',
    description: 'Backtest the Donchian Channel breakout strategy used by the Turtle Traders. Test different entry/exit periods on any stock with equity curves and trade logs.',
    url: 'https://finbacktester.com/trend-strategies',
    siteName: 'FinBacktester',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Donchian Channel Backtester | FinBacktester',
    description: 'Backtest trend-following breakout strategies on any stock. Free tool with equity curves and performance metrics.',
  },
};

export default function TrendStrategiesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}