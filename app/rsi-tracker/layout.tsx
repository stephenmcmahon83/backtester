import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'RSI Signal Tracker | Track Oversold & Overbought Stock Picks | FinBacktester',
  description: 'Track the real-world performance of RSI-based stock picks. See how oversold bounce plays and overbought fade trades actually perform over 5 trading days.',
  alternates: {
    canonical: 'https://finbacktester.com/rsi-tracker',
  },
};

export default function RsiTrackerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}