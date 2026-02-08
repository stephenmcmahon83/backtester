import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Seasonal Signal Tracker | Track Calendar-Based Stock Picks | FinBacktester',
  description: 'Track the real-world performance of seasonality-based stock picks. See how stocks with strong and weak seasonal patterns actually perform over 5 trading days.',
  alternates: {
    canonical: 'https://finbacktester.com/seasonal-tracker',
  },
};

export default function SeasonalTrackerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}