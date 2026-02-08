import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Signal Performance Trackers | Track Stock Pick Performance | FinBacktester',
  description: 'Track the real-world performance of our daily stock picks across RSI, Streak, and Seasonal signals. See historical win rates, average returns, and cumulative performance.',
  alternates: {
    canonical: 'https://finbacktester.com/signal-trackers',
  },
};

export default function SignalTrackersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}