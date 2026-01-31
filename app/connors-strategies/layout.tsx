import type { Metadata } from 'next';

export const metadata: Metadata = {
  // 1. Front-load the "Tool" keyword so it appears first in Google
  title: 'Free Mean Reversion Backtester | RSI 2 & Connors RSI Strategy Tool',
  
  // 2. Optimized description for CTR (Click Through Rate)
  description: 'Instant backtest tool for Mean Reversion strategies. Test RSI(2), Connors RSI, and Bollinger %B setups. Get win rates, drawdowns, and trade logs instantly.',
  
  keywords: [
    'mean reversion backtester', // Primary keyword first
    'RSI 2 strategy backtest',
    'Connors RSI strategy rules',
    'Bollinger Band %B strategy',
    'stock trading simulator',
    'oversold bounce scanner',
    'buy the dip algo'
  ],
  alternates: {
    canonical: 'https://finbacktester.com/connors-strategies',
  },
  openGraph: {
    title: 'Free Mean Reversion Backtest Tool',
    description: 'Test RSI(2), Connors RSI, and Bollinger %B strategies instantly. See historical win rates.',
    url: 'https://finbacktester.com/connors-strategies',
    siteName: 'FinBacktester',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mean Reversion Backtester | FinBacktester',
    description: 'Backtest oversold bounce strategies including RSI and Connors setups.',
  },
};

export default function ConnorsStrategiesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}