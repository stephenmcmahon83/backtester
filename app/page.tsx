// app/page.tsx (The new Home Page)

"use client";

import React, { useState, useEffect, useMemo } from 'react';
// --- FIXED: Use the standard Supabase client you already have installed ---
import { createClient } from "@supabase/supabase-js";

type SnapshotRow = {
  symbol: string;
  c_vs_c200: 'bull' | 'bear';
  c_vs_c100: 'bull' | 'bear';
  p_vs_sma200: 'bull' | 'bear';
  pct_off_26w_high: number;
  pct_off_52w_high: number;
  avg_rsi_2_10d: number | null;
};

type SortConfig = { key: keyof SnapshotRow; direction: 'asc' | 'desc' } | null;

export default function HomePage() {
  // --- FIXED: Initialize the client the same way as your other pages ---
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [snapshotData, setSnapshotData] = useState<SnapshotRow[]>([]);
  const [latestDate, setLatestDate] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'symbol', direction: 'asc' });

  useEffect(() => {
    const fetchSnapshot = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase.functions.invoke('market-snapshot');
        if (error) throw new Error(error.message);
        if (data.error) throw new Error(data.error);

        setSnapshotData(data.snapshotData);
        setLatestDate(data.latestDate);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchSnapshot();
  }, []);

  // --- (The rest of the file is exactly the same and does not need to be changed) ---
  const sortedData = useMemo(() => {
    if (!sortConfig) return snapshotData;
    return [...snapshotData].sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        if (aVal === null) return 1;
        if (bVal === null) return -1;
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });
  }, [snapshotData, sortConfig]);

  const requestSort = (key: keyof SnapshotRow) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

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

  const headers: { key: keyof SnapshotRow; label: string; info: string; isNumeric?: boolean }[] = [
    { key: 'symbol', label: 'Symbol', info: 'Ticker symbol' },
    { key: 'c_vs_c200', label: 'vs 200D Ago', info: 'Current close vs close 200 trading days ago' },
    { key: 'c_vs_c100', label: 'vs 100D Ago', info: 'Current close vs close 100 trading days ago' },
    { key: 'p_vs_sma200', label: 'vs 200D SMA', info: 'Current close vs 200-day simple moving average' },
    { key: 'pct_off_52w_high', label: '% off 52W High', info: 'Percentage below the 52-week high', isNumeric: true },
    { key: 'pct_off_26w_high', label: '% off 26W High', info: 'Percentage below the 26-week high', isNumeric: true },
    { key: 'avg_rsi_2_10d', label: '10D Avg RSI(2)', info: 'Average of the daily RSI(2) over the last 10 days', isNumeric: true },
  ];

  return (
    <div className="bg-white min-h-screen">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Market Snapshot</h1>
        <p className="mt-2 text-gray-500">
          A high-level overview of key trend and momentum metrics across the market.
          {latestDate && ` Last data update: ${new Date(latestDate).toLocaleDateString()}`}
        </p>
        {loading && <div className="text-center py-20 text-indigo-600">Loading market data...</div>}
        {error && <div className="mt-6 bg-red-50 text-red-700 p-4 rounded-md">Error: {error}</div>}
        {!loading && !error && (
          <div className="mt-8 overflow-auto border border-gray-200 rounded-lg shadow-sm" style={{ maxHeight: '80vh' }}>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  {headers.map(header => (
                    <th key={header.key} onClick={() => requestSort(header.key)} className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" title={header.info}>
                      <div className="flex items-center gap-2">
                        {header.label}
                        {sortConfig?.key === header.key && <span>{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedData.map((row) => (
                  <tr key={row.symbol} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-indigo-600">{row.symbol}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm"><BullBearLabel value={row.c_vs_c200} /></td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm"><BullBearLabel value={row.c_vs_c100} /></td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm"><BullBearLabel value={row.p_vs_sma200} /></td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm"><PctLabel value={row.pct_off_52w_high} /></td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm"><PctLabel value={row.pct_off_26w_high} /></td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm"><RsiLabel value={row.avg_rsi_2_10d} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}