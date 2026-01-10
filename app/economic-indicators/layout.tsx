import React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Economic Indicators & Stock Market Analysis | SPY, QQQ, GLD, TLT, XHB Returns',
  description: 'Analyze how economic data releases affect stock and ETF performance. See historical returns for SPY, QQQ, GLD, TLT, and XHB after GDP, CPI, NFP, and 15 other economic indicators with verified release dates from FRED.',
  keywords: [
    'economic indicators',
    'economic data trading',
    'GDP stock market',
    'CPI trading strategy',
    'nonfarm payrolls trading',
    'NFP trading',
    'unemployment rate stocks',
    'retail sales trading',
    'consumer sentiment investing',
    'FRED data analysis',
    'economic calendar trading',
    'macro trading',
    'economic releases',
    'SPY economic indicators',
    'QQQ economic indicators',
    'GLD economic indicators',
    'TLT economic indicators',
    'XHB economic indicators',
    'gold price economic data',
    'bond price economic data',
    'stock market economic data',
    'inflation trading',
    'core PCE trading',
    'PPI trading',
    'durable goods orders',
    'ISM manufacturing',
    'industrial production',
  ],
  alternates: {
    canonical: 'https://finbacktester.com/economic-indicators',
  },
  openGraph: {
    title: 'Economic Indicators & Stock Market Analysis | FinBacktester',
    description: 'How do economic releases affect SPY, QQQ, GLD, TLT, and XHB? Analyze historical returns after 15 economic data releases with verified release dates.',
    url: 'https://finbacktester.com/economic-indicators',
    siteName: 'FinBacktester',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Economic Indicators Analysis | FinBacktester',
    description: 'Backtest how economic data releases impact stocks, tech, gold, bonds, and homebuilders with verified historical release dates from FRED.',
  },
};

export default function EconomicIndicatorsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}