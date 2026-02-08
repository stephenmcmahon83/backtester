import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'RSI Oversold & Overbought Scanner | Mean Reversion Stock Screener',
  
  description: 'Scan all stocks for RSI(2) oversold and overbought conditions. See historical win rates and average returns for current RSI levels across the market.',
  
  keywords: [
    'RSI scanner',
    'oversold stocks today',
    'overbought stocks today',
    'RSI 2 screener',
    'mean reversion scanner',
    'buy the dip stocks',
    'RSI momentum scanner',
    'oversold bounce strategy',
    'RSI trading signals',
    'quantitative stock screener'
  ],
  alternates: {
    canonical: 'https://finbacktester.com/rsi-dashboard',
  },
  openGraph: {
    title: 'RSI Oversold & Overbought Scanner',
    description: 'Find oversold bounce candidates and overbought stocks to avoid. Historical win rates for current RSI levels.',
    url: 'https://finbacktester.com/rsi-dashboard',
    siteName: 'FinBacktester',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RSI Stock Scanner',
    description: 'Scan the market for oversold and overbought RSI conditions with historical performance data.',
  },
};

export default function RsiDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}