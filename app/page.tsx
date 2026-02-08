"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import { createClient } from "@supabase/supabase-js";

type SnapshotRow = {
  symbol: string;
  c_vs_c200: 'bull' | 'bear';
  c_vs_c100: 'bull' | 'bear';
  p_vs_sma200: 'bull' | 'bear';
  pct_off_26w_high: number;
  pct_off_52w_high: number;
  avg_rsi_2_10d: number | null;
  avg_rsi_2_5d: number | null;
  // Streak
  current_streak: number;
  streak_5d_avg_ret: number | null;
  streak_5d_win_pct: number | null;
  streak_trades: number;
  // RSI Bucket
  current_rsi_bucket: number | null;
  rsi_5d_avg_ret: number | null;
  rsi_5d_win_pct: number | null;
  rsi_trades: number;
  // Seasonality
  current_trading_day: number;
  seasonal_5d_avg_ret: number | null;
  seasonal_5d_win_pct: number | null;
  seasonal_trades: number;
  years_of_data: number;
  // Computed
  composite_5d_score?: number | null;
};

type SortConfig = { key: keyof SnapshotRow | 'composite_5d_score'; direction: 'asc' | 'desc' } | null;

export default function HomePage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [snapshotData, setSnapshotData] = useState<SnapshotRow[]>([]);
  const [latestDate, setLatestDate] = useState<string>('');
  const [targetTradingDay, setTargetTradingDay] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Default sort by composite score descending (best outlook first)
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'composite_5d_score', direction: 'desc' });

  // --- Copy/Paste Protection ---
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) && 
        ['c', 'v', 'x', 'a', 'u', 's'].includes(e.key.toLowerCase())
      ) {
        e.preventDefault();
      }
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) {
        e.preventDefault();
      }
    };
    const handleSelectStart = (e: Event) => e.preventDefault();
    const handleDragStart = (e: Event) => e.preventDefault();
    const handleCopy = (e: Event) => e.preventDefault();

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('selectstart', handleSelectStart);
    document.addEventListener('dragstart', handleDragStart);
    document.addEventListener('copy', handleCopy);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('selectstart', handleSelectStart);
      document.removeEventListener('dragstart', handleDragStart);
      document.removeEventListener('copy', handleCopy);
    };
  }, []);

  useEffect(() => {
    const fetchSnapshot = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase.functions.invoke('market-snapshot');
        if (error) throw new Error(error.message);
        if (data.error) throw new Error(data.error);

        // Calculate composite score for each row
        const dataWithScore = data.snapshotData.map((row: SnapshotRow) => {
          // Count how many signals have valid data
          const signals: number[] = [];
          
          if (row.streak_5d_avg_ret !== null && row.streak_trades >= 5) {
            signals.push(row.streak_5d_avg_ret);
          }
          if (row.rsi_5d_avg_ret !== null && row.rsi_trades >= 5) {
            signals.push(row.rsi_5d_avg_ret);
          }
          if (row.seasonal_5d_avg_ret !== null && row.seasonal_trades >= 5) {
            signals.push(row.seasonal_5d_avg_ret);
          }
          
          // Average of available signals (only if at least 2 signals have data)
          const composite_5d_score = signals.length >= 2 
            ? signals.reduce((a, b) => a + b, 0) / signals.length 
            : null;
          
          return { ...row, composite_5d_score };
        });

        setSnapshotData(dataWithScore);
        setLatestDate(data.latestDate);
        setTargetTradingDay(data.targetTradingDay);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchSnapshot();
  }, []);

  const sortedData = useMemo(() => {
    if (!sortConfig) return snapshotData;
    return [...snapshotData].sort((a, b) => {
        const aVal = a[sortConfig.key as keyof SnapshotRow];
        const bVal = b[sortConfig.key as keyof SnapshotRow];
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });
  }, [snapshotData, sortConfig]);

  const requestSort = (key: keyof SnapshotRow | 'composite_5d_score') => {
    let direction: 'asc' | 'desc' = 'desc'; // Default to descending for returns
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  // ==================== DISPLAY COMPONENTS ====================

  const BullBearLabel = ({ value }: { value: 'bull' | 'bear' }) => (
    <span className={`px-2 py-1 text-xs font-bold rounded-full ${value === 'bull' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
      {value.toUpperCase()}
    </span>
  );

  const PctLabel = ({ value }: { value: number }) => {
    const pct = value * 100;
    const color = pct > -10 ? 'text-green-700' : pct > -20 ? 'text-yellow-700' : 'text-red-700';
    return <span className={`font-mono ${color}`}>{pct.toFixed(1)}%</span>;
  };

  const RsiLabel = ({ value }: { value: number | null }) => {
    if (value === null) return <span className="text-gray-400">-</span>;
    const color = value > 70 ? 'text-red-700' : value < 30 ? 'text-green-700' : 'text-gray-800';
    return <span className={`font-mono ${color}`}>{value.toFixed(1)}</span>;
  };

  const StreakLabel = ({ value }: { value: number }) => {
    if (value === 0) return <span className="text-gray-400">0</span>;
    const color = value > 0 ? 'text-green-700' : 'text-red-700';
    return <span className={`font-mono font-bold ${color}`}>{value > 0 ? `+${value}` : value}</span>;
  };

  const ReturnLabel = ({ value }: { value: number | null }) => {
    if (value === null) return <span className="text-gray-400">-</span>;
    const pct = (value * 100).toFixed(2);
    const color = value > 0 ? 'text-green-600' : value < 0 ? 'text-red-600' : 'text-gray-600';
    return <span className={`font-mono ${color}`}>{value > 0 ? '+' : ''}{pct}%</span>;
  };

  const WinPctLabel = ({ value }: { value: number | null }) => {
    if (value === null) return <span className="text-gray-400">-</span>;
    const pct = (value * 100).toFixed(0);
    const color = value >= 0.55 ? 'text-green-600' : value <= 0.45 ? 'text-red-600' : 'text-gray-600';
    return <span className={`font-mono ${color}`}>{pct}%</span>;
  };

  const TradesLabel = ({ value }: { value: number }) => (
    <span className="font-mono text-gray-600">{value}</span>
  );

  const RsiBucketLabel = ({ value }: { value: number | null }) => {
    if (value === null) return <span className="text-gray-400">-</span>;
    return <span className="font-mono text-gray-800">{value}-{value + 5}</span>;
  };

  // Composite Score Label with special styling
  const CompositeScoreLabel = ({ value }: { value: number | null }) => {
    if (value === null) return <span className="text-gray-400">-</span>;
    const pct = (value * 100).toFixed(2);
    const color = value > 0.005 ? 'text-green-700 bg-green-50' : value < -0.005 ? 'text-red-700 bg-red-50' : 'text-gray-700 bg-gray-50';
    return (
      <span className={`font-mono font-bold px-2 py-1 rounded ${color}`}>
        {value > 0 ? '+' : ''}{pct}%
      </span>
    );
  };

  // ==================== COLUMN DEFINITIONS ====================

  type HeaderDef = { 
    key: keyof SnapshotRow | 'composite_5d_score'; 
    label: string; 
    info: string; 
    group?: string;
    render: (row: SnapshotRow) => React.ReactNode;
  };

  const headers: HeaderDef[] = [
    // Core Info
    { key: 'symbol', label: 'Symbol', info: 'Ticker symbol', render: (r) => <span className="font-bold text-indigo-600">{r.symbol}</span> },
    
    // ⭐ COMPOSITE SCORE - NEW COLUMN
    { key: 'composite_5d_score', label: '5D Score', info: 'Average of Streak, RSI, and Seasonal 5-day expected returns (higher = better outlook)', group: 'Outlook', render: (r) => <CompositeScoreLabel value={r.composite_5d_score ?? null} /> },
    
    // Trend Indicators
    { key: 'c_vs_c200', label: 'vs 200D Ago', info: 'Current price compared to price 200 trading days ago', group: 'Trend', render: (r) => <BullBearLabel value={r.c_vs_c200} /> },
    { key: 'c_vs_c100', label: 'vs 100D Ago', info: 'Current price compared to price 100 trading days ago', group: 'Trend', render: (r) => <BullBearLabel value={r.c_vs_c100} /> },
    { key: 'p_vs_sma200', label: 'vs 200D SMA', info: 'Current price compared to 200-day simple moving average', group: 'Trend', render: (r) => <BullBearLabel value={r.p_vs_sma200} /> },
    
    // Position vs Highs
    { key: 'pct_off_52w_high', label: '% off 52W', info: 'How far below the 52-week high', group: 'Highs', render: (r) => <PctLabel value={r.pct_off_52w_high} /> },
    { key: 'pct_off_26w_high', label: '% off 26W', info: 'How far below the 26-week high', group: 'Highs', render: (r) => <PctLabel value={r.pct_off_26w_high} /> },
    
    // RSI Values
    { key: 'avg_rsi_2_5d', label: '5D RSI', info: 'Average RSI(2) over the last 5 trading days', group: 'RSI Values', render: (r) => <RsiLabel value={r.avg_rsi_2_5d} /> },
    { key: 'avg_rsi_2_10d', label: '10D RSI', info: 'Average RSI(2) over the last 10 trading days', group: 'RSI Values', render: (r) => <RsiLabel value={r.avg_rsi_2_10d} /> },
    
    // STREAK SIGNAL
    { key: 'current_streak', label: 'Streak', info: 'Current consecutive up (+) or down (-) days', group: 'Streak Signal', render: (r) => <StreakLabel value={r.current_streak} /> },
    { key: 'streak_5d_avg_ret', label: 'Avg Ret', info: 'Historical average 5-day return at this streak level', group: 'Streak Signal', render: (r) => <ReturnLabel value={r.streak_5d_avg_ret} /> },
    { key: 'streak_5d_win_pct', label: 'Win %', info: 'Historical win rate at this streak level', group: 'Streak Signal', render: (r) => <WinPctLabel value={r.streak_5d_win_pct} /> },
    { key: 'streak_trades', label: 'N', info: 'Sample size', group: 'Streak Signal', render: (r) => <TradesLabel value={r.streak_trades} /> },
    
    // RSI BUCKET SIGNAL
    { key: 'current_rsi_bucket', label: 'RSI Range', info: 'Current 10-day average RSI bucket', group: 'RSI Signal', render: (r) => <RsiBucketLabel value={r.current_rsi_bucket} /> },
    { key: 'rsi_5d_avg_ret', label: 'Avg Ret', info: 'Historical average 5-day return at this RSI range', group: 'RSI Signal', render: (r) => <ReturnLabel value={r.rsi_5d_avg_ret} /> },
    { key: 'rsi_5d_win_pct', label: 'Win %', info: 'Historical win rate at this RSI range', group: 'RSI Signal', render: (r) => <WinPctLabel value={r.rsi_5d_win_pct} /> },
    { key: 'rsi_trades', label: 'N', info: 'Sample size', group: 'RSI Signal', render: (r) => <TradesLabel value={r.rsi_trades} /> },
    
    // SEASONAL SIGNAL
    { key: 'current_trading_day', label: 'Day #', info: 'Upcoming trading day of the year (1-252)', group: 'Seasonal Signal', render: (r) => <span className="font-mono font-medium">#{r.current_trading_day}</span> },
    { key: 'seasonal_5d_avg_ret', label: 'Avg Ret', info: 'Historical average 5-day return starting from this trading day', group: 'Seasonal Signal', render: (r) => <ReturnLabel value={r.seasonal_5d_avg_ret} /> },
    { key: 'seasonal_5d_win_pct', label: 'Win %', info: 'Historical win rate starting from this trading day', group: 'Seasonal Signal', render: (r) => <WinPctLabel value={r.seasonal_5d_win_pct} /> },
    { key: 'seasonal_trades', label: 'Yrs', info: 'Years of data', group: 'Seasonal Signal', render: (r) => <TradesLabel value={r.seasonal_trades} /> },
  ];

  // Group colors
  const groupColors: Record<string, string> = {
    'Outlook': 'bg-indigo-100',
    'Trend': 'bg-blue-50',
    'Highs': 'bg-purple-50',
    'RSI Values': 'bg-yellow-50',
    'Streak Signal': 'bg-green-50',
    'RSI Signal': 'bg-orange-50',
    'Seasonal Signal': 'bg-pink-50',
  };

  return (
    <>
      <Head>
        <title>Market Snapshot: Trend, RSI, Streak & Seasonality Scanner | FinBacktester</title>
        <link rel="canonical" href="https://www.finbacktester.com" />
        <meta 
          name="description" 
          content="Free stock market scanner combining trend indicators, RSI levels, winning/losing streaks, and seasonal patterns with historical backtest statistics." 
        />
        <meta name="robots" content="index, follow" />
      </Head>

      <div 
        className="bg-white min-h-screen"
        style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' } as React.CSSProperties}
      >
        <main className="max-w-[1900px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Market Snapshot</h1>
          
          {/* ==================== IMPROVED INTRO TEXT ==================== */}
          <div className="mt-4 p-5 bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg border border-gray-200">
            <h2 className="text-lg font-bold text-gray-800 mb-3">What This Table Shows</h2>
            <p className="text-gray-700 mb-3">
              This scanner combines <strong>current market conditions</strong> with <strong>historical backtest data</strong> for every stock. 
              The table is sorted by <strong>5D Score</strong> — stocks with the best historical 5-day outlook appear at the top.
            </p>
            
            <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200 mb-4">
              <h3 className="font-bold text-indigo-800 text-sm mb-1">⭐ 5D Score (Composite Outlook)</h3>
              <p className="text-xs text-indigo-700">
                This is the <strong>average of the three 5-day expected returns</strong> (Streak + RSI + Seasonal). 
                A score of +0.50% means that historically, across all three signals, this stock averaged a +0.50% gain over the next 5 trading days when in its current condition. 
                Higher scores = better historical outlook. Stocks with insufficient data show &quot;-&quot;.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                <h3 className="font-bold text-green-800 text-sm mb-1">📊 Streak Signal</h3>
                <p className="text-xs text-green-700">
                  Consecutive up/down days. Shows what happened historically after this streak pattern.
                </p>
              </div>
              
              <div className="p-3 bg-orange-50 rounded-lg border border-orange-100">
                <h3 className="font-bold text-orange-800 text-sm mb-1">📈 RSI Signal</h3>
                <p className="text-xs text-orange-700">
                  RSI momentum bucket. Shows historical performance at this oversold/overbought level.
                </p>
              </div>
              
              <div className="p-3 bg-pink-50 rounded-lg border border-pink-100">
                <h3 className="font-bold text-pink-800 text-sm mb-1">📅 Seasonal Signal</h3>
                <p className="text-xs text-pink-700">
                  Calendar-based pattern. Shows historical 5-day return starting from this trading day.
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-500 mt-3">
              All returns include 0.10% commission. Click any column header to sort.
              {latestDate && ` Data as of ${new Date(latestDate).toLocaleDateString()}.`}
              {targetTradingDay && ` Seasonality: Trading Day #${targetTradingDay}.`}
            </p>
          </div>
          
          {loading && <div className="text-center py-20 text-indigo-600 text-lg">Loading market data...</div>}
          {error && <div className="mt-6 bg-red-50 text-red-700 p-4 rounded-md">Error: {error}</div>}
          
          {!loading && !error && snapshotData.length > 0 && (
            <>
              <div className="mt-6 overflow-auto border border-gray-200 rounded-lg shadow-sm" style={{ maxHeight: '65vh' }}>
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      {headers.map((header, idx) => {
                        const prevGroup = idx > 0 ? headers[idx - 1].group : null;
                        const showBorder = header.group && header.group !== prevGroup;
                        
                        return (
                          <th 
                            key={header.key} 
                            onClick={() => requestSort(header.key)} 
                            className={`
                              px-2 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider 
                              cursor-pointer hover:bg-gray-100 whitespace-nowrap
                              ${showBorder ? 'border-l-2 border-gray-300' : ''}
                              ${header.group ? groupColors[header.group] || '' : ''}
                            `}
                            title={header.info}
                          >
                            <div className="flex items-center gap-1">
                              {header.label}
                              {sortConfig?.key === header.key && (
                                <span className="text-indigo-600">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>
                              )}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sortedData.map((row, rowIdx) => (
                      <tr 
                        key={row.symbol} 
                        className={`hover:bg-gray-50 transition-colors ${rowIdx < 5 ? 'bg-green-50/30' : rowIdx >= sortedData.length - 5 ? 'bg-red-50/30' : ''}`}
                      >
                        {headers.map((header, idx) => {
                          const prevGroup = idx > 0 ? headers[idx - 1].group : null;
                          const showBorder = header.group && header.group !== prevGroup;
                          
                          return (
                            <td 
                              key={header.key} 
                              className={`
                                px-2 py-2 whitespace-nowrap
                                ${showBorder ? 'border-l-2 border-gray-300' : ''}
                              `}
                            >
                              {header.render(row)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Legend for row colors */}
              <div className="mt-2 flex gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="w-4 h-4 bg-green-50/50 border border-green-200 rounded"></span>
                  Top 5 (Best Outlook)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-4 h-4 bg-red-50/50 border border-red-200 rounded"></span>
                  Bottom 5 (Worst Outlook)
                </span>
              </div>

              {/* Educational content section remains the same... */}
              <section className="mt-12 bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">How to Use This Market Snapshot</h2>
                {/* ... rest of educational content ... */}
              </section>
            </>
          )}
        </main>
      </div>
    </>
  );
}