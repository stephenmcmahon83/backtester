"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from "@supabase/supabase-js";
import Link from 'next/link';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ... (Copy type definitions Pick, PerformanceStats, Timeframe from your previous code) ...
type Pick = {
  id: number;
  pick_date: string;
  symbol: string;
  signal_type: string;
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
  avgWin: number;
  avgLoss: number;
};

type Timeframe = '7d' | '30d' | '90d' | '1y' | 'all';

export default function RsiTrackerPage() {
  const [picks, setPicks] = useState<Pick[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [pickType, setPickType] = useState<'all' | 'best' | 'worst'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [timeframe, setTimeframe] = useState<Timeframe>('90d');
  const [symbolSearch, setSymbolSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const picksPerPage = 50;

  useEffect(() => {
    const fetchPicks = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('signal_picks')
          .select('*')
          .eq('signal_type', 'rsi') // <--- FILTER FOR RSI
          .order('pick_date', { ascending: false })
          .order('pick_type', { ascending: true })
          .order('rank', { ascending: true });

        if (error) throw error;
        setPicks(data || []);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchPicks();
  }, []);

  // ... (Keep helper functions: getDateCutoff, filteredPicks, calculateStats, statsForTimeframe, pagination logic) ...
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

  const filteredPicks = useMemo(() => {
    const cutoff = getDateCutoff(timeframe);
    return picks.filter(pick => {
      if (pickType !== 'all' && pick.pick_type !== pickType) return false;
      if (statusFilter === 'open' && pick.exit_price !== null) return false;
      if (statusFilter === 'closed' && pick.exit_price === null) return false;
      if (cutoff && new Date(pick.pick_date) < cutoff) return false;
      if (symbolSearch && !pick.symbol.toLowerCase().includes(symbolSearch.toLowerCase())) return false;
      return true;
    });
  }, [picks, pickType, statusFilter, timeframe, symbolSearch]);

  const calculateStats = (picksList: Pick[]): PerformanceStats => {
    const closed = picksList.filter(p => p.actual_return !== null);
    const open = picksList.filter(p => p.actual_return === null);
    const winners = closed.filter(p => p.is_winner === true);
    const losers = closed.filter(p => p.is_winner === false);
    const returns = closed.map(p => p.actual_return || 0);
    const totalReturn = returns.reduce((sum, r) => sum + r, 0);
    const winReturns = winners.map(p => p.actual_return || 0);
    const lossReturns = losers.map(p => p.actual_return || 0);

    return {
      totalPicks: picksList.length,
      closedPicks: closed.length,
      openPicks: open.length,
      winners: winners.length,
      losers: losers.length,
      winRate: closed.length > 0 ? winners.length / closed.length : 0,
      avgReturn: closed.length > 0 ? totalReturn / closed.length : 0,
      totalReturn,
      bestTrade: returns.length > 0 ? Math.max(...returns) : null,
      worstTrade: returns.length > 0 ? Math.min(...returns) : null,
      avgWin: winReturns.length > 0 ? winReturns.reduce((a, b) => a + b, 0) / winReturns.length : 0,
      avgLoss: lossReturns.length > 0 ? lossReturns.reduce((a, b) => a + b, 0) / lossReturns.length : 0,
    };
  };

  const statsForTimeframe = useMemo(() => {
    const cutoff = getDateCutoff(timeframe);
    const picksInTimeframe = cutoff ? picks.filter(p => new Date(p.pick_date) >= cutoff) : picks;
    
    return {
      best: calculateStats(picksInTimeframe.filter(p => p.pick_type === 'best')),
      worst: calculateStats(picksInTimeframe.filter(p => p.pick_type === 'worst')),
      all: calculateStats(picksInTimeframe),
    };
  }, [picks, timeframe]);

  const totalPages = Math.ceil(filteredPicks.length / picksPerPage);
  const paginatedPicks = filteredPicks.slice((currentPage - 1) * picksPerPage, currentPage * picksPerPage);

  const picksByDate = paginatedPicks.reduce((acc, pick) => {
    if (!acc[pick.pick_date]) acc[pick.pick_date] = [];
    acc[pick.pick_date].push(pick);
    return acc;
  }, {} as Record<string, Pick[]>);

  useEffect(() => { setCurrentPage(1); }, [pickType, statusFilter, timeframe, symbolSearch]);

  const formatPercent = (value: number | null, showPlus = true) => {
    if (value === null || value === undefined) return '-';
    const pct = (value * 100).toFixed(2);
    if (showPlus && value > 0) return `+${pct}%`;
    return `${pct}%`;
  };

  const formatPrice = (value: number | null) => {
    if (value === null) return '-';
    return `$${value.toFixed(2)}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
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

  const longShortSpread = statsForTimeframe.best.avgReturn - statsForTimeframe.worst.avgReturn;

  return (
    <div className="bg-gray-50 min-h-screen">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        <nav className="mb-4 text-sm">
          <Link href="/signal-trackers" className="text-indigo-600 hover:text-indigo-800">
            ← Back to All Signal Trackers
          </Link>
        </nav>

        {/* Header - ORANGE Theme */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-4xl">📉</span>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
              RSI Signal Tracker
            </h1>
          </div>
          <p className="text-gray-600 max-w-3xl">
            Tracking the performance of Mean Reversion using RSI. We buy <strong className="text-green-600">Oversold</strong> stocks (Low RSI) and identify <strong className="text-red-600">Overbought</strong> stocks (High RSI) ripe for a pullback.
          </p>
        </div>

        {/* Timeframe Selector - ORANGE Theme */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
            {(['7d', '30d', '90d', '1y', 'all'] as Timeframe[]).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                  timeframe === tf
                    ? 'bg-orange-600 text-white shadow-md'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                {getTimeframeLabel(tf)}
              </button>
            ))}
          </div>
        </div>

        {/* Performance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          
          {/* Best (Oversold) Card */}
          <div className="bg-white p-5 rounded-xl border border-green-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-green-800 uppercase tracking-wide">
                📉 Oversold (Best)
              </h3>
              <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">Long</span>
            </div>
            <p className="text-xs text-gray-500 mb-3">Low RSI → Bounce Expected</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Closed:</span>
                <span className="font-bold">{statsForTimeframe.best.closedPicks}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Win Rate:</span>
                <span className={`font-bold ${statsForTimeframe.best.winRate >= 0.5 ? 'text-green-600' : 'text-red-600'}`}>
                  {(statsForTimeframe.best.winRate * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Avg Return:</span>
                <span className={`font-bold ${statsForTimeframe.best.avgReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatPercent(statsForTimeframe.best.avgReturn)}
                </span>
              </div>
            </div>
          </div>

          {/* Worst (Overbought) Card */}
          <div className="bg-white p-5 rounded-xl border border-red-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-red-800 uppercase tracking-wide">
                📈 Overbought (Worst)
              </h3>
              <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">Avoid/Short</span>
            </div>
            <p className="text-xs text-gray-500 mb-3">High RSI → Drop Expected</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Closed:</span>
                <span className="font-bold">{statsForTimeframe.worst.closedPicks}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Loss Rate:</span>
                <span className={`font-bold ${statsForTimeframe.worst.winRate <= 0.5 ? 'text-green-600' : 'text-red-600'}`}>
                  {((1 - statsForTimeframe.worst.winRate) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Avg Return:</span>
                <span className={`font-bold ${statsForTimeframe.worst.avgReturn <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatPercent(statsForTimeframe.worst.avgReturn)}
                </span>
              </div>
            </div>
          </div>

           {/* Quick Stats Card */}
           <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
                ⚡ Quick Stats
              </h3>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Picks:</span>
                <span className="font-bold">{statsForTimeframe.all.totalPicks}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">L/S Spread:</span>
                <span className={`font-bold ${longShortSpread > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatPercent(longShortSpread)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 shadow-sm">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Pick Type</label>
              <div className="flex gap-1">
                {(['all', 'best', 'worst'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setPickType(type)}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                      pickType === type 
                        ? type === 'best' ? 'bg-green-600 text-white' 
                          : type === 'worst' ? 'bg-red-600 text-white' 
                          : 'bg-orange-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {type === 'all' ? 'All' : type === 'best' ? 'Oversold' : 'Overbought'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Picks Table */}
        {!loading && !error && (
          <div className="space-y-6">
            {Object.entries(picksByDate).map(([date, datePicks]) => (
              <div key={date} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="bg-gray-50 px-4 py-3 border-b flex justify-between items-center">
                  <h3 className="font-bold text-gray-800">{formatDate(date)}</h3>
                  <span className="text-xs text-gray-500">{datePicks.length} picks</span>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                      <tr>
                        <th className="px-4 py-3 text-left">Type</th>
                        <th className="px-4 py-3 text-left">#</th>
                        <th className="px-4 py-3 text-left">Symbol</th>
                        <th className="px-4 py-3 text-right">RSI Score</th>
                        <th className="px-4 py-3 text-right">Entry</th>
                        <th className="px-4 py-3 text-right">Return</th>
                        <th className="px-4 py-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {datePicks.map(pick => (
                        <tr key={pick.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                              pick.pick_type === 'best' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {pick.pick_type === 'best' ? 'OVERSOLD' : 'OVERBOUGHT'}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-gray-600">#{pick.rank}</td>
                          <td className="px-4 py-3 font-bold text-indigo-600">{pick.symbol}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold">
                            {pick.signal_value.toFixed(1)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono">{formatPrice(pick.entry_price)}</td>
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
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}