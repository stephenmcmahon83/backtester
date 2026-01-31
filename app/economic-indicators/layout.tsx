import React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  // 1. Pivot to "Backtester" and "News Trading" keywords
  title: 'Economic Calendar Backtester | Trade CPI, NFP, & GDP Data',
  
  // 2. Highlight specific assets (Gold/Bonds) which are popular for news trading
  description: 'Backtest trading strategies based on the Economic Calendar. See how SPY, QQQ, Gold (GLD), and Bonds (TLT) historically react to CPI, Nonfarm Payrolls, and GDP releases.',
  
  keywords: [
    'economic calendar backtest', // Primary keyword
    'news trading simulator',
    'CPI trading strategy',
    'NFP reaction history',
    'gold price vs inflation',
    'trade the news software',
    'SPY reaction to GDP',
    'macro trading tool',
    'forex factory alternative',
    'nonfarm payrolls history',
    'inflation stock market correlation'
  ],
  alternates: {
    canonical: 'https://finbacktester.com/economic-indicators',
  },
  openGraph: {
    title: 'Economic Calendar Backtester | Trade the News',
    description: 'Don\'t guess. See exactly how SPY, Gold, and Bonds reacted to the last 50 CPI, NFP, and Fed prints.',
    url: 'https://finbacktester.com/economic-indicators',
    siteName: 'FinBacktester',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Economic Calendar Backtester | FinBacktester',
    description: 'Backtest how economic data releases impact stocks, tech, gold, bonds, and homebuilders.',
  },
};

export default function EconomicIndicatorsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}