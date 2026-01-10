import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Streak Scanner - Stocks on Winning & Losing Streaks Today',
  description: 'Find stocks currently on extended winning or losing streaks. Updated daily. See which stocks have been up or down 3, 4, 5+ consecutive days with historical win rates and average returns. Identify mean reversion or momentum opportunities.',
  keywords: [
    'stocks on winning streak',
    'stocks on winning streak today',
    'stocks down multiple days',
    'stocks up multiple days',
    'stock streak scanner',
    'consecutive day streak scanner',
    'stocks up 5 days in a row',
    'stocks down 5 days in a row',
    'oversold stocks today',
    'overbought stocks today',
    'extended stocks',
    'mean reversion scanner',
    'momentum stocks today',
    'stocks on a run',
    'market scanner',
    'streak trading',
  ],
  alternates: {
    canonical: 'https://finbacktester.com/streaks-scanner',
  },
  openGraph: {
    title: 'Streak Scanner - Stocks on Streaks Today | FinBacktester',
    description: 'Which stocks are on extended winning or losing streaks right now? Updated daily. Find mean reversion and momentum opportunities with historical data.',
    url: 'https://finbacktester.com/streaks-scanner',
    siteName: 'FinBacktester',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Streak Scanner - Stocks on Streaks Today | FinBacktester',
    description: 'Find stocks on winning or losing streaks. See historical performance data for each streak pattern.',
  },
};

export default function StreaksScannerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}