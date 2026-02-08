import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'RSI(2) Bucket Backtester | Mean Reversion Strategy Tool',
  
  description: 'Backtest stock performance based on RSI(2) levels. See historical returns when RSI is oversold (<10) or overbought (>90). Free quantitative analysis tool.',
  
  keywords: [
    'RSI backtester',
    'RSI 2 strategy',
    'oversold stocks scanner',
    'overbought stocks scanner',
    'mean reversion RSI',
    'RSI trading strategy',
    'buy oversold stocks',
    'short overbought stocks',
    'RSI momentum trading',
    'relative strength index backtest'
  ],
  alternates: {
    canonical: 'https://finbacktester.com/rsi-single',
  },
  openGraph: {
    title: 'RSI(2) Bucket Backtester | Mean Reversion Tool',
    description: 'See historical win rates when buying stocks at various RSI(2) levels. Test oversold bounce strategies.',
    url: 'https://finbacktester.com/rsi-single',
    siteName: 'FinBacktester',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RSI(2) Bucket Backtester',
    description: 'Backtest mean reversion strategies based on RSI(2) oversold and overbought levels.',
  },
};

export default function RsiSingleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}