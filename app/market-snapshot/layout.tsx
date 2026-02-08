import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Market Snapshot | Multi-Factor Stock Scanner | FinBacktester',
  description: 'Free stock scanner combining Streak, RSI, and Seasonal signals. See which stocks have the best 5-day historical outlook based on current conditions.',
  alternates: {
    canonical: 'https://finbacktester.com/market-snapshot',
  },
};

export default function MarketSnapshotLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}