"use client";

import React, { useState, useEffect } from 'react';
import { createClient } from "@supabase/supabase-js";
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Title, Tooltip, Legend, LogarithmicScale,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, LogarithmicScale);

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

// Types
type BacktestResults = {
  dates: string[];
  equityCurve: number[];
  zScoreSeries: { date: string; zScore: number }[];
  totalReturn: number;
  maxDrawdown: number;
  profitableYearsPct: number;
  isHolding: boolean;
  currentZScore: number | null;
  currentAboveMA: boolean;
  pendingAction: 'BUY' | 'SELL' | 'NONE';
  totalTrades: number;
  winRate: number;
  avgTradeReturn: number;
  avgWin: number;
  avgLoss: number;
  avgHoldingDays: number;
  tradesExitedByTime: number;
  tradesExitedByZScore: number;
  trades: {
    entryDate: string;
    exitDate: string;
    entryPrice: number;
    exitPrice: number;
    entryZScore: number;
    exitZScore: number;
    holdingDays: number;
    exitReason: 'Z-Score' | 'Max Days';
    return: number;
  }[];
  yearlyStats: {
    year: string;
    return: number;
    count: number;
    winRate: number;
  }[];
  correlation: number;
};

// Parameter options
const LOOKBACK_PERIODS = [10, 15, 20, 25, 30];
const ENTRY_ZSCORES = [-3.0, -2.5, -2.0, -1.5, -1.0];
const EXIT_ZSCORES = [-1.5, -1.0, -0.5, 0, 0.5, 1.0];
const TREND_MA_PERIODS = [0, 50, 100, 150, 200]; // 0 = no filter
const MAX_HOLDING_DAYS = [10, 15, 20, 25, 30, 0]; // 0 = no limit
const WILLIAMS_R_THRESHOLDS = [0, -70, -80, -90, -100]; // 0 = no filter

const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`;
const formatWholePercent = (value: number) => `${Math.round(value * 100)}%`;

const EquityChart = ({ data, title }: { data: BacktestResults; title: string }) => {
  const chartData = {
    labels: data.dates,
    datasets: [{
      label: 'Strategy Equity',
      data: data.equityCurve,
      borderColor: 'rgb(79, 70, 229)',
      backgroundColor: 'rgba(79, 70, 229, 0.5)',
      pointRadius: 0,
      borderWidth: 2,
    }],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: true, text: title, font: { size: 18 } }
    },
    scales: {
      y: {
        type: 'logarithmic' as const,
        ticks: { callback: (value: any) => `$${Number(value).toLocaleString()}` }
      }
    }
  };
  return <div className="h-[400px] w-full"><Line options={options} data={chartData} /></div>;
};

const ZScoreChart = ({ data, entryZ, exitZ }: { data: BacktestResults; entryZ: number; exitZ: number }) => {
  const chartData = {
    labels: data.zScoreSeries.map(d => d.date),
    datasets: [
      {
        label: 'Z-Score',
        data: data.zScoreSeries.map(d => d.zScore),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        pointRadius: 0,
        borderWidth: 1.5,
        fill: true,
      },
      {
        label: `Entry (${entryZ})`,
        data: data.zScoreSeries.map(() => entryZ),
        borderColor: 'rgb(34, 197, 94)',
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
      },
      {
        label: `Exit (${exitZ})`,
        data: data.zScoreSeries.map(() => exitZ),
        borderColor: 'rgb(239, 68, 68)',
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
      },
      {
        label: 'Mean (0)',
        data: data.zScoreSeries.map(() => 0),
        borderColor: 'rgb(156, 163, 175)',
        borderWidth: 1,
        borderDash: [2, 2],
        pointRadius: 0,
      },
    ],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'top' as const },
      title: { display: true, text: 'Price Ratio Z-Score Over Time', font: { size: 16 } }
    },
    scales: {
      y: {
        min: -4,
        max: 4,
        ticks: { stepSize: 1 }
      }
    }
  };
  return <div className="h-[300px] w-full"><Line options={options} data={chartData} /></div>;
};

export default function PairsTradingPage() {
  const [tickerList, setTickerList] = useState<string[]>([]);
  const [stockA, setStockA] = useState<string>('');
  const [stockB, setStockB] = useState<string>('SPY');
  const [lookbackPeriod, setLookbackPeriod] = useState<number>(20);
  const [entryZScore, setEntryZScore] = useState<number>(-2.0);
  const [exitZScore, setExitZScore] = useState<number>(-1.0);
  const [trendMAPeriod, setTrendMAPeriod] = useState<number>(200);
  const [maxHoldingDays, setMaxHoldingDays] = useState<number>(20);
  const [williamsRThreshold, setWilliamsRThreshold] = useState<number>(0);
  const [startYear, setStartYear] = useState('all');
  const [results, setResults] = useState<BacktestResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingTickers, setLoadingTickers] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const yearOptions = ['all'];
  for (let y = new Date().getFullYear(); y >= 1990; y--) {
    yearOptions.push(y.toString());
  }

  // --- Copy/Paste/Screenshot Protection ---
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) && 
        ['c', 'v', 'x', 'a', 'u', 's', 'p'].includes(e.key.toLowerCase())
      ) {
        e.preventDefault();
      }
      if (e.key === 'F12') e.preventDefault();
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && ['i', 'j', 'c'].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
      if (e.key === 'PrintScreen') {
        e.preventDefault();
        navigator.clipboard.writeText('');
      }
    };
    
    const handleSelectStart = (e: Event) => e.preventDefault();
    const handleDragStart = (e: Event) => e.preventDefault();
    const handleCopy = (e: Event) => e.preventDefault();
    const handleCut = (e: Event) => e.preventDefault();
    const handlePaste = (e: Event) => e.preventDefault();

    const handleVisibilityChange = () => {
      const content = document.getElementById('protected-content');
      if (content) {
        content.style.filter = document.hidden ? 'blur(10px)' : 'none';
      }
    };

    const handleBeforePrint = () => { document.body.style.display = 'none'; };
    const handleAfterPrint = () => { document.body.style.display = 'block'; };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('selectstart', handleSelectStart);
    document.addEventListener('dragstart', handleDragStart);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('cut', handleCut);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('selectstart', handleSelectStart);
      document.removeEventListener('dragstart', handleDragStart);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('cut', handleCut);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []);

  // Fetch available tickers from symbols table
  useEffect(() => {
    const fetchTickers = async () => {
      try {
        const { data, error } = await supabase
          .from('symbols')
          .select('symbol')
          .order('symbol', { ascending: true });
        
        if (error) throw error;
        if (data) {
          const symbols = data.map((row: any) => row.symbol);
          setTickerList(symbols);
          // Set default stock A if available
          if (symbols.length >= 1 && !stockA) {
            // Find a stock that's not SPY for default
            const defaultStock = symbols.find((s: string) => s !== 'SPY') || symbols[0];
            setStockA(defaultStock);
          }
        }
      } catch (err) {
        console.error("Error fetching tickers:", err);
      } finally {
        setLoadingTickers(false);
      }
    };
    fetchTickers();
  }, []);

  const handleRunBacktest = async () => {
    if (!stockA || !stockB) {
      setError("Please select both stocks.");
      return;
    }
    if (stockA === stockB) {
      setError("Please select two different stocks.");
      return;
    }
    if (entryZScore >= exitZScore) {
      setError("Entry Z-Score must be less than Exit Z-Score.");
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('pairs-trading', {
        body: {
          stockA: stockA.toUpperCase(),
          stockB: stockB.toUpperCase(),
          lookbackPeriod,
          entryZScore,
          exitZScore,
          trendMAPeriod,
          maxHoldingDays,
          williamsRThreshold,
          startYear,
        },
      });

      if (invokeError) throw new Error(invokeError.message);
      if (data.error) throw new Error(data.error);
      setResults(data);
    } catch (e: any) {
      console.error("Backtest failed:", e);
      setError(e.message || "An unknown error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="protected-content"
      className="min-h-screen bg-gray-100 p-4 sm:p-8 font-sans text-gray-900"
      style={{
        userSelect: 'none',
        WebkitUserSelect: 'none',
        MozUserSelect: 'none',
        msUserSelect: 'none',
        WebkitTouchCallout: 'none',
      } as React.CSSProperties}
    >
      <main className="container mx-auto max-w-7xl bg-white p-6 rounded-lg shadow-xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-extrabold text-gray-900">Pairs Trading Backtester</h1>
          <p className="text-gray-500 mt-2">
            Long Stock A when its ratio to Stock B (benchmark) drops below entry Z-score threshold.
            <br />Exit when Z-score recovers OR max holding period reached. Includes trend and oversold filters.
          </p>
        </div>

        {/* Input Controls - Row 1: Stock Selection */}
        <div className="mb-4 p-6 bg-slate-50 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-4">Stock Selection</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 items-end gap-4">
            {/* Stock A */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Stock A <span className="text-green-600">(Long Position)</span>
              </label>
              {loadingTickers ? (
                <div className="h-10 w-full bg-gray-200 rounded animate-pulse"></div>
              ) : (
                <select
                  value={stockA}
                  onChange={(e) => setStockA(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 bg-white outline-none cursor-pointer"
                >
                  <option value="">Select...</option>
                  {tickerList.map((ticker) => (
                    <option key={ticker} value={ticker}>{ticker}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Stock B */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Stock B <span className="text-blue-600">(Benchmark)</span>
              </label>
              {loadingTickers ? (
                <div className="h-10 w-full bg-gray-200 rounded animate-pulse"></div>
              ) : (
                <select
                  value={stockB}
                  onChange={(e) => setStockB(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 bg-white outline-none cursor-pointer"
                >
                  <option value="">Select...</option>
                  {tickerList.map((ticker) => (
                    <option key={ticker} value={ticker}>{ticker}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Start Year */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Start Year</label>
              <select
                value={startYear}
                onChange={(e) => setStartYear(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 bg-white outline-none cursor-pointer"
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>{year === 'all' ? 'All Data' : year}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Input Controls - Row 2: Z-Score Parameters */}
        <div className="mb-4 p-6 bg-blue-50 rounded-xl border border-blue-200 shadow-sm">
          <h3 className="text-sm font-bold text-blue-700 uppercase tracking-wide mb-4">Z-Score Parameters</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 items-end gap-4">
            {/* Lookback Period */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Lookback Period <span className="text-gray-500 font-normal">(days)</span>
              </label>
              <select
                value={lookbackPeriod}
                onChange={(e) => setLookbackPeriod(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 bg-white outline-none cursor-pointer"
              >
                {LOOKBACK_PERIODS.map((period) => (
                  <option key={period} value={period}>{period} days</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">Rolling window for mean & std dev</p>
            </div>

            {/* Entry Z-Score */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Entry Z-Score <span className="text-green-600 font-normal">(buy below)</span>
              </label>
              <select
                value={entryZScore}
                onChange={(e) => setEntryZScore(Number(e.target.value))}
                className="w-full px-4 py-2 border border-green-300 rounded-md focus:ring-2 focus:ring-green-500 bg-white outline-none cursor-pointer"
              >
                {ENTRY_ZSCORES.map((z) => (
                  <option key={z} value={z}>{z} σ</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">Enter when Z-Score drops below this</p>
            </div>

            {/* Exit Z-Score */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Exit Z-Score <span className="text-red-600 font-normal">(sell above)</span>
              </label>
              <select
                value={exitZScore}
                onChange={(e) => setExitZScore(Number(e.target.value))}
                className="w-full px-4 py-2 border border-red-300 rounded-md focus:ring-2 focus:ring-red-500 bg-white outline-none cursor-pointer"
              >
                {EXIT_ZSCORES.map((z) => (
                  <option key={z} value={z}>{z} σ</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">Exit when Z-Score rises above this</p>
            </div>
          </div>
        </div>

        {/* Input Controls - Row 3: Filters */}
        <div className="mb-4 p-6 bg-amber-50 rounded-xl border border-amber-200 shadow-sm">
          <h3 className="text-sm font-bold text-amber-700 uppercase tracking-wide mb-4">Trade Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 items-end gap-4">
            {/* Trend Filter MA */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Trend Filter MA <span className="text-gray-500 font-normal">(Stock A)</span>
              </label>
              <select
                value={trendMAPeriod}
                onChange={(e) => setTrendMAPeriod(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500 bg-white outline-none cursor-pointer"
              >
                {TREND_MA_PERIODS.map((period) => (
                  <option key={period} value={period}>
                    {period === 0 ? 'No Filter' : `Close > ${period}-day MA`}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">Only buy dips in uptrends</p>
            </div>

            {/* Max Holding Days */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Max Holding Days
              </label>
              <select
                value={maxHoldingDays}
                onChange={(e) => setMaxHoldingDays(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500 bg-white outline-none cursor-pointer"
              >
                {MAX_HOLDING_DAYS.map((days) => (
                  <option key={days} value={days}>
                    {days === 0 ? 'No Limit' : `${days} days max`}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">Force exit losers after X days</p>
            </div>

            {/* Williams %R */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Williams %R Filter
              </label>
              <select
                value={williamsRThreshold}
                onChange={(e) => setWilliamsRThreshold(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500 bg-white outline-none cursor-pointer"
              >
                {WILLIAMS_R_THRESHOLDS.map((threshold) => (
                  <option key={threshold} value={threshold}>
                    {threshold === 0 ? 'No Filter' : `%R < ${threshold}`}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">Confirm oversold on Stock A</p>
            </div>
          </div>
        </div>

        {/* Run Button */}
        <div className="mb-8">
          <button
            onClick={handleRunBacktest}
            disabled={loading || loadingTickers || !stockA || !stockB}
            className="w-full px-8 py-3 bg-indigo-600 text-white font-bold rounded-md hover:bg-indigo-700 disabled:bg-gray-400 transition-colors shadow-md text-lg"
          >
            {loading ? 'Running Backtest...' : 'Run Backtest'}
          </button>
        </div>

        {/* Strategy Description */}
        <div className="mb-8 p-4 bg-indigo-50 border-l-4 border-indigo-500 rounded-r-md text-indigo-900 text-sm">
          <span className="font-bold">Strategy Logic:</span>
          <ul className="mt-2 space-y-1 list-disc list-inside">
            <li>Calculate Price Ratio = {stockA || 'Stock A'} Close / {stockB || 'Stock B'} Close</li>
            <li>Compute {lookbackPeriod}-day rolling mean and standard deviation of the ratio</li>
            <li>Z-Score = (Current Ratio - Mean) / StdDev</li>
            <li>
              <span className="text-green-700 font-semibold">ENTRY:</span> Z-Score &lt; {entryZScore}
              {trendMAPeriod > 0 && <span> AND Close &gt; {trendMAPeriod}-day MA</span>}
              {williamsRThreshold < 0 && <span> AND Williams %R &lt; {williamsRThreshold}</span>}
            </li>
            <li>
              <span className="text-red-700 font-semibold">EXIT:</span> Z-Score &gt; {exitZScore}
              {maxHoldingDays > 0 && <span> OR Days Held &gt; {maxHoldingDays}</span>}
            </li>
          </ul>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 text-red-700" role="alert">
            <p className="font-bold">Error</p>
            <p>{error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-r-transparent mb-4"></div>
            <p className="text-gray-600">Running backtest for {stockA} / {stockB}...</p>
          </div>
        )}

        {/* Results */}
        {results && (
          <div className="space-y-12 animate-fade-in">
            {/* Correlation Badge */}
            <div className="flex justify-center gap-4 flex-wrap">
              <div className={`px-6 py-3 rounded-full text-lg font-bold ${
                results.correlation >= 0.7 ? 'bg-green-100 text-green-800 border border-green-300' :
                results.correlation >= 0.4 ? 'bg-yellow-100 text-yellow-800 border border-yellow-300' :
                'bg-red-100 text-red-800 border border-red-300'
              }`}>
                Correlation: {results.correlation.toFixed(3)}
                {results.correlation >= 0.7 ? ' ✓ Strong' : results.correlation >= 0.4 ? ' ⚠ Moderate' : ' ✗ Weak'}
              </div>
              {maxHoldingDays > 0 && results.totalTrades > 0 && (
                <div className="px-6 py-3 rounded-full text-lg font-bold bg-purple-100 text-purple-800 border border-purple-300">
                  Time Exits: {results.tradesExitedByTime} ({Math.round(results.tradesExitedByTime / results.totalTrades * 100)}%)
                </div>
              )}
            </div>

            {/* Equity Curve Chart */}
            <div className="p-4 border border-gray-200 rounded-lg bg-white shadow-md">
              <EquityChart
                data={results}
                title={`Pairs Trading: Long ${stockA} vs ${stockB}`}
              />
            </div>

            {/* Z-Score Chart */}
            <div className="p-4 border border-gray-200 rounded-lg bg-white shadow-md">
              <ZScoreChart data={results} entryZ={entryZScore} exitZ={exitZScore} />
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Performance Summary */}
              <div>
                <h2 className="text-xl font-bold mb-4 text-gray-800 border-b pb-2">Performance Summary</h2>
                <div className="overflow-hidden border border-gray-200 rounded-lg shadow-sm mb-8">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Metric</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Result</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      <tr>
                        <td className="px-4 py-3 font-medium text-gray-900">Total Return</td>
                        <td className={`px-4 py-3 text-right font-bold ${results.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatWholePercent(results.totalReturn)}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 font-medium text-gray-900">Max Drawdown</td>
                        <td className="px-4 py-3 text-right text-red-600 font-medium">
                          {formatWholePercent(results.maxDrawdown)}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 font-medium text-gray-900">% Profitable Years</td>
                        <td className="px-4 py-3 text-right text-gray-700 font-medium">
                          {formatWholePercent(results.profitableYearsPct)}
                        </td>
                      </tr>

                      <tr className="bg-gray-50">
                        <td colSpan={2} className="px-4 py-2 text-xs font-bold text-gray-500 uppercase">Current Status</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 font-medium text-gray-900">Position</td>
                        <td className={`px-4 py-3 text-right font-bold ${results.isHolding ? 'text-blue-600' : 'text-gray-400'}`}>
                          {results.isHolding ? `LONG ${stockA}` : 'CASH'}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 font-medium text-gray-900">Current Z-Score</td>
                        <td className={`px-4 py-3 text-right font-bold ${
                          results.currentZScore !== null && results.currentZScore < entryZScore ? 'text-green-600' :
                          results.currentZScore !== null && results.currentZScore > exitZScore ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {results.currentZScore !== null ? results.currentZScore.toFixed(2) + ' σ' : '—'}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 font-medium text-gray-900">Close &gt; {trendMAPeriod > 0 ? trendMAPeriod : '—'} MA?</td>
                        <td className={`px-4 py-3 text-right font-bold ${results.currentAboveMA ? 'text-green-600' : 'text-red-600'}`}>
                          {trendMAPeriod > 0 ? (results.currentAboveMA ? 'YES ✓' : 'NO ✗') : 'N/A'}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 font-medium text-gray-900">Signal for Tomorrow</td>
                        <td className={`px-4 py-3 text-right font-bold ${
                          results.pendingAction === 'BUY' ? 'text-green-600' :
                          results.pendingAction === 'SELL' ? 'text-red-600' : 'text-gray-400'
                        }`}>
                          {results.pendingAction}
                        </td>
                      </tr>

                      <tr className="bg-gray-50">
                        <td colSpan={2} className="px-4 py-2 text-xs font-bold text-gray-500 uppercase">Trade Stats</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 font-medium text-gray-900">Total Trades</td>
                        <td className="px-4 py-3 text-right text-gray-700">{results.totalTrades}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 font-medium text-gray-900">Win Rate</td>
                        <td className="px-4 py-3 text-right text-gray-700">{formatWholePercent(results.winRate)}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 font-medium text-gray-900">Avg Return / Trade</td>
                        <td className={`px-4 py-3 text-right ${results.avgTradeReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatPercent(results.avgTradeReturn)}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 font-medium text-gray-900">Avg Winning Trade</td>
                        <td className="px-4 py-3 text-right text-green-600">{formatPercent(results.avgWin)}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 font-medium text-gray-900">Avg Losing Trade</td>
                        <td className="px-4 py-3 text-right text-red-600">{formatPercent(results.avgLoss)}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 font-medium text-gray-900">Avg Holding Period</td>
                        <td className="px-4 py-3 text-right text-gray-700">{results.avgHoldingDays.toFixed(1)} days</td>
                      </tr>
                      {maxHoldingDays > 0 && (
                        <>
                          <tr>
                            <td className="px-4 py-3 font-medium text-gray-900">Exits by Z-Score</td>
                            <td className="px-4 py-3 text-right text-gray-700">{results.tradesExitedByZScore}</td>
                          </tr>
                          <tr>
                            <td className="px-4 py-3 font-medium text-gray-900">Exits by Time Limit</td>
                            <td className="px-4 py-3 text-right text-gray-700">{results.tradesExitedByTime}</td>
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Yearly Performance */}
              <div>
                <h2 className="text-xl font-bold mb-4 text-gray-800 border-b pb-2">Yearly Performance</h2>
                <div className="overflow-auto max-h-[500px] border border-gray-200 rounded-lg shadow-sm">
                  <table className="min-w-full divide-y divide-gray-200 relative">
                    <thead className="bg-gray-50 sticky top-0 shadow-sm z-10">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Year</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Return</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Win Rate</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase"># Trades</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200 text-sm">
                      {results.yearlyStats.map((stat) => (
                        <tr key={stat.year} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-bold text-gray-900">{stat.year}</td>
                          <td className={`px-4 py-3 text-right font-bold ${stat.return >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatPercent(stat.return)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700">{formatWholePercent(stat.winRate)}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{stat.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Trade Log */}
            <div>
              <h2 className="text-2xl font-bold mb-4 text-center text-gray-800">Trade Log</h2>
              <div className="overflow-auto max-h-[500px] border border-gray-200 rounded-lg shadow-sm">
                <table className="min-w-full divide-y divide-gray-200 relative">
                  <thead className="bg-gray-50 sticky top-0 shadow-sm z-10">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entry</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Exit</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Entry Z</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Exit Z</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Entry $</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Exit $</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Days</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Exit Reason</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Return</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200 text-sm">
                    {results.trades.slice().reverse().map((trade, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-3 py-3 whitespace-nowrap text-gray-700">{trade.entryDate}</td>
                        <td className="px-3 py-3 whitespace-nowrap text-gray-700">{trade.exitDate}</td>
                        <td className="px-3 py-3 whitespace-nowrap text-right text-green-600 font-mono">{trade.entryZScore.toFixed(2)}</td>
                        <td className="px-3 py-3 whitespace-nowrap text-right text-red-600 font-mono">{trade.exitZScore.toFixed(2)}</td>
                        <td className="px-3 py-3 whitespace-nowrap text-right text-gray-700">${trade.entryPrice.toFixed(2)}</td>
                        <td className="px-3 py-3 whitespace-nowrap text-right text-gray-700">${trade.exitPrice.toFixed(2)}</td>
                        <td className="px-3 py-3 whitespace-nowrap text-right text-gray-500">{trade.holdingDays}</td>
                        <td className={`px-3 py-3 whitespace-nowrap text-center text-xs font-semibold ${
                          trade.exitReason === 'Z-Score' ? 'text-blue-600' : 'text-orange-600'
                        }`}>
                          {trade.exitReason}
                        </td>
                        <td className={`px-3 py-3 whitespace-nowrap text-right font-bold ${trade.return >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatPercent(trade.return)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Educational Content */}
            <section className="mt-12 bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">How This Pairs Trading Strategy Works</h2>

              <div className="prose prose-gray max-w-none text-gray-700 space-y-4">
                <p>
                  This strategy exploits the statistical tendency of correlated assets to revert to their historical relationship.
                  When Stock A becomes unusually cheap relative to Stock B (the benchmark), we buy Stock A expecting the ratio to normalize.
                </p>

                <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">The Z-Score Calculation</h3>

                <p>
                  We calculate the <strong>price ratio</strong> = Stock A Close / Stock B Close. Then we compute a rolling
                  mean and standard deviation over the lookback period (e.g., 20 days). The <strong>Z-Score</strong> tells us
                  how many standard deviations the current ratio is from its mean:
                </p>

                <div className="bg-gray-100 p-4 rounded-lg font-mono text-sm">
                  Z-Score = (Current Ratio - Rolling Mean) / Rolling Std Dev
                </div>

                <p>
                  A Z-Score of -2 means Stock A is 2 standard deviations cheaper than normal relative to Stock B—
                  statistically, this should only happen ~2.5% of the time and tends to revert.
                </p>

                <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">Entry & Exit Rules</h3>

                <p>
                  <strong>Entry:</strong> When Z-Score drops below the entry threshold (e.g., -2), Stock A is undervalued
                  relative to Stock B. We go long Stock A at the next day&apos;s open. The trend filter (Close &gt; MA) ensures
                  we only buy dips in uptrends, avoiding falling knives. The Williams %R filter confirms the stock is oversold.
                </p>

                <p>
                  <strong>Exit:</strong> We exit when either (1) the Z-Score recovers above the exit threshold (e.g., -1),
                  indicating mean reversion has occurred, or (2) we&apos;ve held for the maximum number of days, cutting losers
                  that haven&apos;t reverted.
                </p>

                <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">Optimal Parameters</h3>

                <p>
                  Research suggests optimal parameters are often in these ranges:
                </p>

                <ul className="list-disc pl-6 space-y-1">
                  <li><strong>Lookback:</strong> 15-20 days (short enough to be responsive, long enough to be stable)</li>
                  <li><strong>Entry Z-Score:</strong> -2 to -2.5 (statistical extremes)</li>
                  <li><strong>Exit Z-Score:</strong> -1 to 0 (partial recovery, not waiting for full reversion)</li>
                  <li><strong>Max Holding Days:</strong> 20 days (typical trade duration is 5-10 days)</li>
                  <li><strong>Trend Filter:</strong> 200-day MA (stay in long-term uptrends)</li>
                </ul>

                <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">Risk Considerations</h3>

                <p>
                  This is a <strong>long-only</strong> implementation—you&apos;re exposed to market risk. In a full pairs trade,
                  you would simultaneously short Stock B to hedge. The correlation between stocks can break down due to
                  fundamental changes. The max holding days filter helps limit losses when mean reversion doesn&apos;t occur.
                </p>

                <p>
                  <strong>Note:</strong> Past performance does not guarantee future results. Always validate strategies
                  with out-of-sample testing before trading real capital.
                </p>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}