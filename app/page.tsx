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
};

type SortConfig = { key: keyof SnapshotRow; direction: 'asc' | 'desc' } | null;

export default function HomePage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [snapshotData, setSnapshotData] = useState<SnapshotRow[]>([]);
  const [latestDate, setLatestDate] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'symbol', direction: 'asc' });

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
    { key: 'avg_rsi_2_5d', label: '5D Avg RSI(2)', info: 'Average of the daily RSI(2) over the last 5 days', isNumeric: true },
    { key: 'avg_rsi_2_10d', label: '10D Avg RSI(2)', info: 'Average of the daily RSI(2) over the last 10 days', isNumeric: true },
  ];

  return (
    <>
      {/* SEO Meta Tags - UPDATED FOR TRAFFIC */}
      <Head>
        <title>Stock Trend Scanner: RSI & Moving Average Screener | FinBacktester</title>
        
        {/* Canonical Tag - Fixes the duplicate search result issue */}
        <link rel="canonical" href="https://www.finbacktester.com" />

        <meta 
          name="description" 
          content="Free stock market scanner. Identify trends with 200-day moving averages, RSI(2) overbought/oversold readings, and 52-week high momentum strategies." 
        />
        <meta name="keywords" content="market snapshot, stock trends, momentum indicators, RSI screener, 200-day moving average scanner, 52-week high strategy, stock screening tool" />
        <meta name="robots" content="index, follow" />

        {/* Open Graph Tags for Social Sharing */}
        <meta property="og:title" content="Stock Trend Scanner: RSI & Moving Average Screener" />
        <meta property="og:description" content="Identify Bull/Bear trends and overbought stocks instantly." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://www.finbacktester.com" />

        {/* JSON-LD Structured Data - Tells Google this is a Software Application */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "name": "FinBacktester Market Snapshot",
              "applicationCategory": "FinanceApplication",
              "operatingSystem": "Web",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD"
              },
              "description": "A quantitative finance tool for scanning stock market trends, RSI momentum, and mean reversion setups."
            })
          }}
        />
      </Head>

      <div 
        className="bg-white min-h-screen"
        style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' } as React.CSSProperties}
      >
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Market Snapshot</h1>
          <p className="mt-2 text-gray-500">
            A high-level overview of key trend and momentum metrics across the market.
            {latestDate && ` Last data update: ${new Date(latestDate).toLocaleDateString()}`}
          </p>
          
          {loading && <div className="text-center py-20 text-indigo-600">Loading market data...</div>}
          {error && <div className="mt-6 bg-red-50 text-red-700 p-4 rounded-md">Error: {error}</div>}
          
          {!loading && !error && (
            <>
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
                        <td className="px-6 py-4 whitespace-nowrap text-sm"><RsiLabel value={row.avg_rsi_2_5d} /></td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm"><RsiLabel value={row.avg_rsi_2_10d} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* --- EDUCATIONAL CONTENT SECTION (Optimized for Search Keywords) --- */}
              <section className="mt-12 bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Understanding the Market Snapshot</h2>
                
                <div className="prose prose-gray max-w-none text-gray-700 space-y-4">
                  <p>
                    This snapshot provides a quick way to assess the health of the market and individual stocks across several key dimensions. Rather than digging through charts one by one, you can scan the entire universe at a glance to see which stocks are in uptrends, which are struggling, which are near their highs, and which might be oversold. All columns are sortable—just click any header to reorder the table by that metric.
                  </p>

                  <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">How to use a 200-day Moving Average Scanner</h3>

                  <p>
                    The first three data columns classify each stock as either "BULL" or "BEAR" based on simple trend comparisons. <strong>vs 200D Ago</strong> compares today's closing price to where the stock closed 200 trading days ago (roughly 10 months). If the stock is higher now, it's labeled BULL; if lower, BEAR. This is a straightforward way to determine if the stock is in a long-term uptrend or downtrend.
                  </p>

                  <p>
                    <strong>vs 100D Ago</strong> applies the same logic but with a shorter lookback—about 5 months. A stock that's BULL on the 200D comparison but BEAR on the 100D might be in a longer-term uptrend that's recently started to weaken. <strong>vs 200D SMA</strong> compares the current price to the 200-day simple moving average. This is a classic technical indicator: stocks above their 200-day moving average are generally considered to be in healthy uptrends.
                  </p>

                  <p>
                    When all three columns show BULL, the stock is in a strong, confirmed uptrend. When all three show BEAR, the trend is clearly down. Mixed readings suggest a stock in transition—potentially an early reversal or a pullback within a larger trend. These labels give you a quick filter for trend-following strategies: you might only consider buying stocks where all three are green.
                  </p>

                  <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">Scanning for Breakouts (52-Week Highs)</h3>

                  <p>
                    <strong>% off 52W High</strong> shows how far below its 52-week (1 year) high the stock currently sits. A reading of -5% means the stock is only 5% below its yearly peak—close to breaking out or already at new highs. A reading of -30% means the stock has dropped 30% from its high—either a correction in an uptrend or part of a larger decline. The color coding helps you quickly spot the range: green for stocks near highs, yellow for moderate pullbacks, red for steep declines.
                  </p>

                  <p>
                    <strong>% off 26W High</strong> is the same concept but over a 6-month window. Comparing the two columns tells you about the trajectory. A stock that's -5% off its 52-week high but -15% off its 26-week high recently peaked and has been declining. A stock that's -20% off its 52-week high but only -3% off its 26-week high has been recovering from an earlier low. These nuances help you identify stocks at different phases of their price cycles.
                  </p>

                  <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">RSI 2 Trading Strategy Screener</h3>

                  <p>
                    RSI(2) is a short-term momentum oscillator that measures recent price movement on a scale from 0 to 100. Readings below 30 indicate short-term oversold conditions (the stock has dropped sharply and may bounce), while readings above 70 indicate overbought conditions (the stock has rallied hard and may pause or pull back). Because RSI(2) is so sensitive, it can whipsaw daily—so these columns show the average RSI(2) over the past 5 and 10 days to smooth the noise.
                  </p>

                  <p>
                    A <strong>5D Avg RSI(2)</strong> below 30 means the stock has been consistently weak over the past week—potentially an opportunity for mean-reversion traders looking to buy oversold dips. A reading above 70 means sustained strength. The <strong>10D Avg RSI(2)</strong> extends this view to two weeks. When both 5D and 10D averages are extreme in the same direction, the stock has been persistently overbought or oversold, not just a one-day spike.
                  </p>

                  <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">How to Use This Snapshot</h3>

                  <p>
                    Think of this table as a screening tool to narrow your focus. If you're a trend follower, sort by the trend columns and look for stocks where all three show BULL. If you're a mean-reversion trader, sort by the RSI columns and look for deeply oversold stocks (low 5D/10D RSI) that are still in longer-term uptrends (BULL on the 200D comparisons). If you're hunting for breakout candidates, sort by % off 52W High and find stocks closest to 0%—they may be about to make new highs.
                  </p>

                  <p>
                    This snapshot updates with the latest market data, so you're always seeing current readings. However, these are lagging indicators based on past prices—they describe what has happened, not what will happen. Use them to generate ideas and filter the universe, then do deeper research on the individual stocks that catch your attention. Combining this high-level view with chart analysis and fundamental context will give you a more complete picture before making any trading decisions.
                  </p>
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </>
  );
}