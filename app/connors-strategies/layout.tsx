import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mean Reversion Backtester - RSI, Bollinger Band & Connors Strategies',
  description: 'Backtest classic mean reversion and oversold bounce strategies on any stock. Test RSI(2), RSI(4), Connors RSI, Bollinger %B, and multi-day pullback setups. See historical win rates, drawdowns, yearly performance, and complete trade logs with commissions included.',
  keywords: [
    'mean reversion strategy',
    'mean reversion backtest',
    'RSI backtest',
    'RSI 2 strategy',
    'RSI 2 backtest',
    'RSI 4 strategy',
    'Connors RSI',
    'Connors RSI strategy',
    'Connors RSI backtest',
    'oversold stocks strategy',
    'oversold bounce',
    'buy the dip backtest',
    'RSI trading strategy',
    'RSI below 10',
    'RSI below 30',
    'Bollinger Bands strategy',
    'Bollinger %B',
    'overbought oversold',
    'mean reversion trading',
    'pullback strategy',
    'dip buying strategy',
    'swing trading backtest',
    'R3 strategy',
  ],
  alternates: {
    canonical: 'https://finbacktester.com/connors-strategies',
  },
  openGraph: {
    title: 'Mean Reversion Backtester - RSI & Connors Strategies | FinBacktester',
    description: 'Backtest RSI(2), Connors RSI, Bollinger %B, and other mean reversion strategies on any stock. See win rates, drawdowns, and trade-by-trade results.',
    url: 'https://finbacktester.com/connors-strategies',
    siteName: 'FinBacktester',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mean Reversion Backtester | FinBacktester',
    description: 'Backtest oversold bounce strategies including RSI, Bollinger Bands, and Connors setups. Free tool with detailed trade logs.',
  },
};

export default function ConnorsStrategiesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}