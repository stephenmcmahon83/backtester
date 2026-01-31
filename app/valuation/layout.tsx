import type { Metadata } from 'next';

export const metadata: Metadata = {
  // 1. "Intrinsic Value" and "Fair Value" are the money keywords here
  title: 'Intrinsic Value Calculator | 15x Earnings Stock Valuation Tool',
  
  // 2. Frame it as a question: "Is the stock overvalued?"
  description: 'Is the stock overvalued? Use our free Fair Value Calculator based on the 15x Earnings model (Peter Lynch Rule). Calculate intrinsic value for AAPL, NVDA, TSLA, and more.',
  
  keywords: [
    'intrinsic value calculator', // #1 Keyword
    'fair value stock calculator',
    '15x earnings model',
    'peter lynch valuation',
    'stock overvalued or undervalued',
    'PE ratio calculator',
    'graham number alternative',
    'stock valuation software',
    'fundamental analysis tool',
    'historical PE ratio chart'
  ],
  alternates: {
    canonical: 'https://finbacktester.com/valuation',
  },
  openGraph: {
    title: 'Free Intrinsic Value Calculator | FinBacktester',
    description: 'Enter a ticker to see if a stock is trading above or below its Fair Value based on historical earnings.',
    url: 'https://finbacktester.com/valuation',
    siteName: 'FinBacktester',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Stock Fair Value Calculator',
    description: 'Instantly calculate if a stock is overvalued using the 15x Earnings model.',
  },
};

export default function ValuationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}