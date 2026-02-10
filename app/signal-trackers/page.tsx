"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from "@supabase/supabase-js";
import Link from 'next/link';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Pick = {
  id: number;
  pick_date: string;
  symbol: string;
  signal_type: 'composite' | 'rsi' | 'streak' | 'seasonal';
  pick_type: 'best' | 'worst';
  rank: number;
  signal_value: number;
  historical_avg_return: number;
  historical_win_rate: number;
  historical_trade_count: number;
  entry_price: number;
  exit_date: string | null;
  exit_price: number | null;
  actual_return: number | null;
  is_winner: boolean | null;
};

type PerformanceStats = {
  totalPicks: number;
  closedPicks: number;
  openPicks: number;
  winners: number;
  losers: number;
  winRate: number;
  avgReturn: number;
  totalReturn: number;
  bestTrade: number | null;
  worstTrade: number | null;
};

type SignalType = 'composite' | 'rsi' | 'streak' | 'seasonal';
type Timeframe = '7d' | '30d' | '90d' | '1y' | 'all';

const SIGNAL_CONFIG: Record<SignalType, {
  name: string;
  description: string;
  bestLabel: string;
  worstLabel: string;
  valueLabel: string;
  color: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  icon: string;
  href: string;
}> = {
  composite: {
    name: 'Composite',
    description: 'Combined Streak + RSI + Seasonal outlook score',
    bestLabel: 'Best 5-Day Outlook',
    worstLabel: 'Worst 5-Day Outlook',
    valueLabel: 'Score',
    color: 'indigo',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
    textColor: 'text-indigo-800',
    icon: '⭐',
    href: '/market-snapshot',
  },
  rsi: {
    name: 'RSI(2)',
    description: 'Relative Strength Index extremes',
    bestLabel: 'Oversold (Bounce Expected)',
    worstLabel: 'Overbought (Drop Expected)',
    valueLabel: 'RSI',
    color: 'orange',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    textColor: 'text-orange-800',
    icon: '📉',
    href: '/rsi-dashboard',
  },
  streak: {
    name: 'Streaks',
    description: 'Consecutive up/down days',
    bestLabel: 'Losing Streak (Bounce Expected)',
    worstLabel: 'Winning Streak (Pullback Expected)',
    valueLabel: 'Days',
    color: 'purple',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    textColor: 'text-purple-800',
    icon: '🔥',
    href: '/streaks-scanner',
  },
  seasonal: {
    name: 'Seasonality',
    description: 'Calendar-based patterns',
    bestLabel: 'Strong Seasonal Period',
    worstLabel: 'Weak Seasonal Period',
    valueLabel: 'Score',
    color: 'pink',
    bgColor: 'bg-pink-50',
    borderColor: 'border-pink-200',
    textColor: 'text-pink-800',
    icon: '📅',
    href: '/seasonal-dashboard',
  },
};

const SIGNAL_ORDER: SignalType[] = ['composite', 'rsi', 'streak', 'seasonal'];

export default function SignalTrackersPage() {
  const [allPicks, setAllPicks] = useState<Pick[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>('90d');

  useEffect(() => {
    const fetchAllPicks = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const { data, error } = await supabase
          .from('signal_picks')
          .select('*')
          .order('pick_date', { ascending: false });

        if (error) throw error;
        setAllPicks(data || []);
      } catch (e: any) {
        console.error('Error fetching picks:', e);
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAllPicks();
  }, []);

  const getDateCutoff = (tf: Timeframe): Date | null => {
    if (tf === 'all') return null;
    const now = new Date();
    switch(tf) {
      case '7d': return new Date(now.setDate(now.getDate() - 7));
      case '30d': return new Date(now.setDate(now.getDate() - 30));
      case '90d': return new Date(now.setDate(now.getDate() - 90));
      case '1y': return new Date(now.setFullYear(now.getFullYear() - 1));
      default: return null;
    }
  };

  const calculateStats = (picks: Pick[]): PerformanceStats => {
    const closedPicks = picks.filter(p => p.actual_return !== null);
    const openPicks = picks.filter(p => p.actual_return === null);
    const winners = closedPicks.filter(p => p.is_winner === true);
    const losers = closedPicks.filter(p => p.is_winner === false);
    const returns = closedPicks.map(p => p.actual_return || 0);
    const totalReturn = returns.reduce((sum, r) => sum + r, 0);

    return {
      totalPicks: picks.length,
      closedPicks: closedPicks.length,
      openPicks: openPicks.length,
      winners: winners.length,
      losers: losers.length,
      winRate: closedPicks.length > 0 ? winners.length / closedPicks.length : 0,
      avgReturn: closedPicks.length > 0 ? totalReturn / closedPicks.length : 0,
      totalReturn,
      bestTrade: returns.length > 0 ? Math.max(...returns) : null,
      worstTrade: returns.length > 0 ? Math.min(...returns) : null,
    };
  };

  const statsBySignalType = useMemo(() => {
    const cutoff = getDateCutoff(timeframe);
    const picksInTimeframe = cutoff 
      ? allPicks.filter(p => new Date(p.pick_date) >= cutoff)
      : allPicks;
    
    const result: Record<string, { best: PerformanceStats; worst: PerformanceStats; spread: number }> = {};
    
    SIGNAL_ORDER.forEach(type => {
      const typePicks = picksInTimeframe.filter(p => p.signal_type === type);
      const bestPicks = typePicks.filter(p => p.pick_type === 'best');
      const worstPicks = typePicks.filter(p => p.pick_type === 'worst');
      
      const bestStats = calculateStats(bestPicks);
      const worstStats = calculateStats(worstPicks);
      
      result[type] = {
        best: bestStats,
        worst: worstStats,
        spread: bestStats.avgReturn - worstStats.avgReturn,
      };
    });
    
    return result;
  }, [allPicks, timeframe]);

  const formatPercent = (value: number | null, showPlus = true) => {
    if (value === null || value === undefined) return '-';
    const pct = (value * 100).toFixed(2);
    if (showPlus && value > 0) return `+${pct}%`;
    return `${pct}%`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getTimeframeLabel = (tf: Timeframe) => {
    switch(tf) {
      case '7d': return 'Last 7 Days';
      case '30d': return 'Last 30 Days';
      case '90d': return 'Last 90 Days';
      case '1y': return 'Last Year';
      case 'all': return 'All Time';
    }
  };

    const formatSignalValue = (pick: Pick) => {
    if (pick.signal_type === 'rsi') {
      return pick.signal_value?.toFixed(1);
    }
    if (pick.signal_type === 'streak') {
      return pick.signal_value > 0 ? `+${pick.signal_value}` : pick.signal_value;
    }
    // FIX: Composite score is a raw number, not a percent. Just show it as is.
    if (pick.signal_type === 'composite') {
      return pick.signal_value?.toFixed(1);
    }
    
    // Seasonal is likely the only one that needs percent formatting now
    return formatPercent(pick.signal_value);
  };
  
  // Get recent picks for preview
  const recentPicks = allPicks.slice(0, 20);

  return (
    <div className="bg-gray-50 min-h-screen">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
            Signal Performance Trackers
          </h1>
          <p className="mt-2 text-gray-600 max-w-3xl">
            Track the real-world performance of our daily stock picks. Each day we identify 
            stocks at signal extremes and track their 5-day forward returns.
          </p>
          
          {!loading && (
            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full font-medium">
                {allPicks.length.toLocaleString()} Total Picks
              </span>
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full font-medium">
                {allPicks.filter(p => p.exit_price !== null).length.toLocaleString()} Closed
              </span>
              <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full font-medium">
                {allPicks.filter(p => p.exit_price === null).length.toLocaleString()} Open
              </span>
            </div>
          )}
        </div>

        {/* Timeframe Selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Performance Timeframe
          </label>
          <div className="flex flex-wrap gap-2">
            {(['7d', '30d', '90d', '1y', 'all'] as Timeframe[]).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                  timeframe === tf
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                {getTimeframeLabel(tf)}
              </button>
            ))}
          </div>
        </div>

        {/* Loading/Error */}
        {loading && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading signal data...</p>
          </div>
        )}
        
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <p className="text-red-700 font-medium">Error loading data</p>
            <p className="text-red-600 text-sm mt-1">{error}</p>
          </div>
        )}

        {/* Signal Type Cards */}
        {!loading && !error && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {SIGNAL_ORDER.map(type => {
                const config = SIGNAL_CONFIG[type];
                const stats = statsBySignalType[type];
                if (!stats) return null;
                
                const hasData = stats.best.closedPicks > 0 || stats.worst.closedPicks > 0;
                
                return (
                  <Link 
                    key={type}
                    href={config.href}
                    className={`block p-6 rounded-xl border-2 transition-all hover:shadow-lg hover:-translate-y-1 ${config.bgColor} ${config.borderColor}`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{config.icon}</span>
                        <h3 className={`text-lg font-bold ${config.textColor}`}>{config.name}</h3>
                      </div>
                      <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded">
                        {stats.best.closedPicks + stats.worst.closedPicks} trades
                      </span>
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-4">{config.description}</p>
                    
                    {hasData ? (
                      <div className="space-y-3">
                        {/* Best Picks Stats */}
                        <div className="bg-white/60 rounded-lg p-3">
                          <div className="text-xs font-medium text-green-700 mb-1">
                            ▲ {config.bestLabel}
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Win Rate: <strong className={stats.best.winRate >= 0.5 ? 'text-green-600' : 'text-red-600'}>
                              {(stats.best.winRate * 100).toFixed(0)}%
                            </strong></span>
                            <span>Avg: <strong className={stats.best.avgReturn >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {formatPercent(stats.best.avgReturn)}
                            </strong></span>
                          </div>
                        </div>
                        
                        {/* Worst Picks Stats */}
                        <div className="bg-white/60 rounded-lg p-3">
                          <div className="text-xs font-medium text-red-700 mb-1">
                            ▼ {config.worstLabel}
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Loss Rate: <strong className={stats.worst.winRate <= 0.5 ? 'text-green-600' : 'text-red-600'}>
                              {((1 - stats.worst.winRate) * 100).toFixed(0)}%
                            </strong></span>
                            <span>Avg: <strong className={stats.worst.avgReturn <= 0 ? 'text-green-600' : 'text-red-600'}>
                              {formatPercent(stats.worst.avgReturn)}
                            </strong></span>
                          </div>
                        </div>
                        
                        {/* Spread */}
                        <div className="pt-2 border-t border-gray-200">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Long-Short Spread:</span>
                            <span className={`font-bold ${stats.spread > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatPercent(stats.spread)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4 text-gray-500 text-sm">
                        No closed trades yet
                      </div>
                    )}
                    
                    <div className="mt-4 text-center">
                      <span className={`text-sm font-semibold ${config.textColor}`}>
                        View Details →
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Recent Picks Preview */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                <h3 className="font-bold text-gray-800">Recent Picks</h3>
                <span className="text-xs text-gray-500">Last 20 picks across all signals</span>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-left">Signal</th>
                      <th className="px-4 py-3 text-left">Type</th>
                      <th className="px-4 py-3 text-left">Symbol</th>
                      <th className="px-4 py-3 text-right">Score</th>
                      <th className="px-4 py-3 text-right">Entry</th>
                      <th className="px-4 py-3 text-right">Return</th>
                      <th className="px-4 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {recentPicks.map((pick) => {
                      const config = SIGNAL_CONFIG[pick.signal_type as SignalType];
                      return (
                        <tr key={pick.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-600">{formatDate(pick.pick_date)}</td>
                          <td className="px-4 py-3">
                            <span className="flex items-center gap-1">
                              <span className="text-lg" title={config?.name}>{config?.icon || '📊'}</span>
                              <span className="text-xs text-gray-500 hidden sm:inline">{config?.name}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                              pick.pick_type === 'best' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {pick.pick_type.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-bold text-indigo-600">{pick.symbol}</td>
                          <td className="px-4 py-3 text-right font-mono">
                            {formatSignalValue(pick)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono">${pick.entry_price?.toFixed(2)}</td>
                          <td className={`px-4 py-3 text-right font-mono font-bold ${
                            pick.actual_return === null ? 'text-gray-400' :
                            pick.actual_return >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {formatPercent(pick.actual_return)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {pick.exit_price === null ? (
                              <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">OPEN</span>
                            ) : pick.is_winner ? (
                              <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">WIN</span>
                            ) : (
                              <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">LOSS</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* How It Works */}
            <section className="mt-12 bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900 mb-4">How Signal Tracking Works</h2>
              
              <div className="grid md:grid-cols-3 gap-6">
                <div className="text-center p-4">
                  <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-xl font-bold text-indigo-600">1</span>
                  </div>
                  <h3 className="font-semibold text-gray-800 mb-2">Daily Selection</h3>
                  <p className="text-sm text-gray-600">
                    Each trading day, we identify the top 5 &quot;best&quot; and bottom 5 &quot;worst&quot; stocks for each signal type.
                  </p>
                </div>
                
                <div className="text-center p-4">
                  <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-xl font-bold text-indigo-600">2</span>
                  </div>
                  <h3 className="font-semibold text-gray-800 mb-2">5-Day Hold</h3>
                  <p className="text-sm text-gray-600">
                    We track each pick for exactly 5 trading days, recording entry and exit prices.
                  </p>
                </div>
                
                <div className="text-center p-4">
                  <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-xl font-bold text-indigo-600">3</span>
                  </div>
                  <h3 className="font-semibold text-gray-800 mb-2">Performance Analysis</h3>
                  <p className="text-sm text-gray-600">
                    We calculate win rates, average returns, and the &quot;spread&quot; between best and worst picks.
                  </p>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-indigo-50 rounded-lg">
                <h4 className="font-semibold text-indigo-800 mb-2">Understanding the Spread</h4>
                <p className="text-sm text-indigo-700">
                  A positive spread means &quot;best&quot; picks outperform &quot;worst&quot; picks—exactly what we want! 
                  This indicates the signal has predictive power. The larger the spread, the stronger the signal.
                </p>
              </div>

              <div className="mt-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
                <h4 className="font-semibold text-amber-800 mb-2">⭐ About the Composite Signal</h4>
                <p className="text-sm text-amber-700">
                  The Composite signal combines RSI, Streak, and Seasonal data into a single score. 
                  It represents the average expected 5-day return across all three signals, giving you 
                  a more robust measure of a stock&apos;s near-term outlook.
                </p>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}