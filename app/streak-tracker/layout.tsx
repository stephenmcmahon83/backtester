import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Streak Signal Tracker | Track Winning & Losing Streak Stock Picks | FinBacktester',
  description: 'Track the real-world performance of streak-based stock picks. See how stocks on big losing streaks (bounce plays) and winning streaks (pullback candidates) actually perform.',
  alternates: {
    canonical: 'https://finbacktester.com/streak-tracker',
  },
};

export default function StreakTrackerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}