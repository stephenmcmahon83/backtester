"use client";

import React, { useState, useMemo } from 'react';
import { createClient } from "@supabase/supabase-js";
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  LogarithmicScale,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  LogarithmicScale
);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// --- Types ---
type StrategyType = 'Relative Strength' | 'Donchian Channel' | 'RSI';

type BacktestResults = {
  dates: string[];
  bnhEquityCurve: number[];
  strategyEquityCurve: number[];
  bnhTotalReturn: number;
  bnhMaxDrawdown: number;
  strategyTotalReturn: number;
  strategyMaxDrawdown: number;
  trades: {
    entryDate: string;
    exitDate: string;
    entryPrice: number;
    exitPrice: number;
    return: number;
  }[];
  maxTrade: number;
  minTrade: number;
  profitableYearsPct: number;
  nextDaySignal: 'BUY' | 'SELL' | 'HOLD';
  // Optional fields for compatibility
  bullPeriodReturn?: number;
  bearPeriodReturn?: number;
};

type SignalSummary = {
  strategy: string;
  signal: 'BUY' | 'SELL' | 'HOLD';
};

// --- Configuration ---
const rsiOptions = [
  { label: 'Enter < 10, Exit > 50', entry: 10, exit: 50 },
  { label: 'Enter < 10, Exit > 60', entry: 10, exit: 60 },
  { label: 'Enter < 15, Exit > 50', entry: 15, exit: 50 },
  { label: 'Enter < 15, Exit > 60', entry: 15, exit: 60 },
  { label: 'Enter < 15, Exit > 70', entry: 15, exit: 70 },
  { label: 'Enter < 20, Exit > 60', entry: 20, exit: 60 },
  { label: 'Enter < 20, Exit > 70', entry: 20, exit: 70 },
  { label: 'Enter < 25, Exit > 70', entry: 25, exit: 70 },
  { label: 'Enter < 30, Exit > 70', entry: 30, exit: 70 },
  { label: 'Enter < 30, Exit > 80', entry: 30, exit: 80 },
];

const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`;

// --- Chart Component ---
const BacktestChart = ({ data, label }: { data: BacktestResults, label: string }) => {
  const chartData = {
    labels: data.dates,
    datasets: [
      {
        label: 'Buy & Hold',
        data: data.bnhEquityCurve,
        borderColor: 'rgb(54, 162, 235)',
        backgroundColor: 'rgba(54, 162, 235, 0.5)',
        pointRadius: 0,
        borderWidth: 2,
      },
      {
        label: label,
        data: data.strategyEquityCurve,
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
        pointRadius: 0,
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: { position: 'top' as const },
      title: { display: true, text: 'Equity Curve (Log Scale, 0.05% Comm.)' },
    },
    scales: { y: { type: 'logarithmic' as const, ticks: { callback: (value: any) => Number(value).toFixed(2) } } }
  };

  return <Line options={options} data={chartData} />;
};

export default function UniversalBacktesterPage() {
  const [ticker, setTicker] = useState('SPY');
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyType>('Relative Strength');
  
  // Parameters
  const [rsPeriod, setRsPeriod] = useState(100);
  const [donchianEntry, setDonchianEntry] = useState(50);
  const [donchianExit, setDonchianExit] = useState(20);
  const [rsiSelection, setRsiSelection] = useState(0);

  const [results, setResults] = useState<BacktestResults | null>(null);
  const [signalSummaries, setSignalSummaries] = useState<SignalSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Options for dropdowns (10 to 200 step 10)
  const periodOptions = useMemo(() => Array.from({ length: (200 - 10) / 10 + 1 }, (_, i) => 10 + i * 10), []);

  const handleRunBacktest = async () => {
    if (!ticker) {
      setError("Please enter a ticker symbol.");
      return;
    }
    setLoading(true);
    setError(null);
    setResults(null);
    setSignalSummaries([]);

    try {
      // Payloads
      const rsPayload = { ticker: ticker.toUpperCase(), period: rsPeriod };
      const donchianPayload = { ticker: ticker.toUpperCase(), entryPeriod: donchianEntry, exitPeriod: donchianExit };
      const rsiPayload = { 
        ticker: ticker.toUpperCase(), 
        entryRsi: rsiOptions[rsiSelection].entry, 
        exitRsi: rsiOptions[rsiSelection].exit 
      };

      // Run all in parallel
      const [rsRes, donchianRes, rsiRes] = await Promise.all([
        supabase.functions.invoke('backtest-99day', { body: rsPayload }),
        supabase.functions.invoke('donchian-backtest', { body: donchianPayload }),
        supabase.functions.invoke('backtest-rsi', { body: rsiPayload })
      ]);

      // Check selected strategy for errors
      let activeError = null;
      if (selectedStrategy === 'Relative Strength' && rsRes.error) activeError = rsRes.error;
      if (selectedStrategy === 'Donchian Channel' && donchianRes.error) activeError = donchianRes.error;
      if (selectedStrategy === 'RSI' && rsiRes.error) activeError = rsiRes.error;

      if (activeError) throw new Error(activeError.message || "Unknown error occurred");

      // Set active results
      if (selectedStrategy === 'Relative Strength') setResults(rsRes.data);
      else if (selectedStrategy === 'Donchian Channel') setResults(donchianRes.data);
      else if (selectedStrategy === 'RSI') setResults(rsiRes.data);

      // Build Signal Table
      const signals: SignalSummary[] = [];
      if (!rsRes.error && rsRes.data) signals.push({ strategy: `Relative Strength (${rsPeriod})`, signal: rsRes.data.nextDaySignal });
      if (!donchianRes.error && donchianRes.data) signals.push({ strategy: `Donchian (${donchianEntry}/${donchianExit})`, signal: donchianRes.data.nextDaySignal });
      if (!rsiRes.error && rsiRes.data) signals.push({ strategy: `RSI (${rsiOptions[rsiSelection].entry}/${rsiOptions[rsiSelection].exit})`, signal: rsiRes.data.nextDaySignal });
      setSignalSummaries(signals);

    } catch (e: any) {
      console.error("Backtest failed:", e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Helper to get chart label
  const getChartLabel = () => {
    if (selectedStrategy === 'Relative Strength') return `RS Strategy (${rsPeriod}-Day)`;
    if (selectedStrategy === 'Donchian Channel') return `Donchian (${donchianEntry}/${donchianExit})`;
    return `RSI Strategy`;
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-8 font-sans">
      <main className="container mx-auto max-w-6xl bg-white p-6 rounded-lg shadow-md">
        <h1 className="text-3xl font-bold text-center mb-6 text-gray-800">Universal Strategy Backtester</h1>
        
        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 bg-gray-50 p-4 rounded-lg border">
          
          {/* Ticker */}
          <div className="flex flex-col">
            <label className="text-sm font-semibold text-gray-600 mb-1">Ticker</label>
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              className="px-3 py-2 border rounded-md"
            />
          </div>

          {/* Strategy Selection */}
          <div className="flex flex-col">
            <label className="text-sm font-semibold text-gray-600 mb-1">Strategy</label>
            <select
              value={selectedStrategy}
              onChange={(e) => setSelectedStrategy(e.target.value as StrategyType)}
              className="px-3 py-2 border rounded-md bg-white"
            >
              <option value="Relative Strength">Relative Strength</option>
              <option value="Donchian Channel">Donchian Channel</option>
              <option value="RSI">RSI Mean Reversion</option>
            </select>
          </div>

          {/* Dynamic Parameters */}
          <div className="flex flex-col lg:col-span-2">
            <label className="text-sm font-semibold text-gray-600 mb-1">Parameters</label>
            <div className="flex gap-2">
              {selectedStrategy === 'Relative Strength' && (
                <select value={rsPeriod} onChange={(e) => setRsPeriod(Number(e.target.value))} className="flex-1 px-3 py-2 border rounded-md bg-white">
                  {periodOptions.map(p => <option key={p} value={p}>Lookback: {p}</option>)}
                </select>
              )}

              {selectedStrategy === 'Donchian Channel' && (
                <>
                  <select value={donchianEntry} onChange={(e) => setDonchianEntry(Number(e.target.value))} className="flex-1 px-3 py-2 border rounded-md bg-white">
                    {periodOptions.map(p => <option key={p} value={p}>Entry: {p}</option>)}
                  </select>
                  <select value={donchianExit} onChange={(e) => setDonchianExit(Number(e.target.value))} className="flex-1 px-3 py-2 border rounded-md bg-white">
                    {periodOptions.map(p => <option key={p} value={p}>Exit: {p}</option>)}
                  </select>
                </>
              )}

              {selectedStrategy === 'RSI' && (
                <select value={rsiSelection} onChange={(e) => setRsiSelection(Number(e.target.value))} className="flex-1 px-3 py-2 border rounded-md bg-white">
                  {rsiOptions.map((opt, idx) => <option key={idx} value={idx}>{opt.label}</option>)}
                </select>
              )}
            </div>
          </div>

          {/* Run Button */}
          <div className="md:col-span-2 lg:col-span-4 mt-2">
             <button
              onClick={handleRunBacktest}
              disabled={loading}
              className="w-full py-3 bg-indigo-600 text-white font-bold rounded-md shadow hover:bg-indigo-700 disabled:bg-gray-400 transition-colors"
            >
              {loading ? 'Running Strategies...' : 'Run Universal Backtest'}
            </button>
          </div>
        </div>

        {error && <div className="p-4 mb-6 bg-red-100 border border-red-400 text-red-700 rounded text-center font-semibold">{error}</div>}

        {/* RESULTS SECTION */}
        {results && (
          <div className="space-y-10">
            
            {/* 1. Signal Table */}
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h3 className="text-lg font-bold text-blue-800 mb-3 text-center">Signals for Next Trading Day ({ticker})</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white rounded-md overflow-hidden shadow-sm">
                  <thead className="bg-blue-100">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-bold text-blue-900 uppercase">Strategy Config</th>
                      <th className="px-4 py-2 text-center text-xs font-bold text-blue-900 uppercase">Signal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {signalSummaries.map((item, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-2 text-sm font-medium text-gray-700">{item.strategy}</td>
                        <td className={`px-4 py-2 text-sm font-bold text-center ${item.signal === 'BUY' ? 'text-green-600' : item.signal === 'SELL' ? 'text-red-600' : 'text-gray-500'}`}>
                          {item.signal}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 2. Chart */}
            <div className="p-4 border rounded-lg bg-white shadow-sm">
              <BacktestChart data={results} label={getChartLabel()} />
            </div>

            {/* 3. Performance Summary */}
            <div>
              <h2 className="text-2xl font-bold mb-4 text-center">Performance Summary ({selectedStrategy})</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 border">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Metric</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Buy & Hold</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Strategy</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    <tr>
                      <td className="px-6 py-4 font-medium text-gray-900">Total Return</td>
                      <td className="px-6 py-4 text-right">{formatPercent(results.bnhTotalReturn)}</td>
                      <td className="px-6 py-4 text-right font-bold">{formatPercent(results.strategyTotalReturn)}</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 font-medium text-gray-900">Max Drawdown</td>
                      <td className="px-6 py-4 text-right text-red-600">{formatPercent(results.bnhMaxDrawdown)}</td>
                      <td className="px-6 py-4 text-right text-red-600">{formatPercent(results.strategyMaxDrawdown)}</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 font-medium text-gray-900">Profitable Years</td>
                      <td className="px-6 py-4 text-right text-gray-400">-</td>
                      <td className="px-6 py-4 text-right">{formatPercent(results.profitableYearsPct)}</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 font-medium text-gray-900">Best Trade</td>
                      <td className="px-6 py-4 text-right text-gray-400">-</td>
                      <td className="px-6 py-4 text-right text-green-600">{formatPercent(results.maxTrade)}</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 font-medium text-gray-900">Worst Trade</td>
                      <td className="px-6 py-4 text-right text-gray-400">-</td>
                      <td className="px-6 py-4 text-right text-red-600">{formatPercent(results.minTrade)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 4. Trade Log */}
            <div>
              <h2 className="text-2xl font-bold mb-4 text-center">Trade Log</h2>
              <div className="overflow-auto h-[50vh] border rounded-lg shadow-sm">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entry Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Exit Date</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Price In</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Price Out</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Return</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {results.trades
                      .slice()
                      .reverse()
                      .map((trade, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{trade.entryDate || 'Signal'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{trade.exitDate}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right">{Number(trade.entryPrice).toFixed(2)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right">{Number(trade.exitPrice).toFixed(2)}</td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-bold ${trade.return >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatPercent(trade.return)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}