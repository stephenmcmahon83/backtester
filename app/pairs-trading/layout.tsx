import React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pairs Trading Backtester | Z-Score Mean Reversion Strategy',
  description: 'Backtest pairs trading strategies using z-score based entry and exit signals. Analyze historical performance of long-only mean reversion trades between correlated stocks.',
  keywords: [
    'pairs trading',
    'pairs trading backtester',
    'z-score trading',
    'mean reversion strategy',
    'statistical arbitrage',
    'correlation trading',
    'market neutral strategy',
    'spread trading',
    'cointegration trading',
    'quantitative trading',
    'algorithmic trading backtest',
  ],
  openGraph: {
    title: 'Pairs Trading Backtester | FinBacktester',
    description: 'Backtest pairs trading strategies using z-score based entry and exit. Analyze correlated stock pairs for mean reversion opportunities.',
    url: 'https://finbacktester.com/pairs-trading',
    siteName: 'FinBacktester',
    type: 'website',
  },
};

export default function PairsTradingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}