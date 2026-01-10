import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Stock Valuation Tool | 15x Earnings Fair Value Calculator',
  description: 'Analyze stock valuations using the 15x earnings model. View historical EPS, revenue, margins, ROE, ROIC, debt ratios, and compare current price to fair value estimates. Free fundamental analysis tool.',
  keywords: [
    'stock valuation',
    'stock valuation tool',
    'fair value calculator',
    'fair value estimator',
    '15x earnings',
    '15x earnings model',
    'EPS analysis',
    'earnings per share',
    'fundamental analysis',
    'stock analyzer',
    'intrinsic value',
    'intrinsic value calculator',
    'ROE analysis',
    'ROIC analysis',
    'return on equity',
    'return on invested capital',
    'PE ratio',
    'price to earnings',
    'stock research tool',
    'financial ratios',
    'debt to equity',
    'profit margin analysis',
    'book value',
    'stock screener',
    'value investing',
    'Graham number',
  ],
  alternates: {
    canonical: 'https://finbacktester.com/valuation',
  },
  openGraph: {
    title: 'Stock Valuation Tool | 15x Earnings Fair Value Calculator | FinBacktester',
    description: 'Analyze any stock with the 15x earnings fair value model. View 10+ years of EPS, revenue, margins, ROE, ROIC, and see if the current price is above or below fair value.',
    url: 'https://finbacktester.com/valuation',
    siteName: 'FinBacktester',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Stock Valuation Tool | FinBacktester',
    description: 'Free fundamental analysis tool. Compare stock prices to 15x earnings fair value with historical financial data.',
  },
};

export default function ValuationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}