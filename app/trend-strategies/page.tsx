"use client";

import React, { useState, useEffect } from 'react';
import { createClient } from "@supabase/supabase-js";
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, LogarithmicScale } from 'chart.js';
import { MultiSelectDropdown } from '@/components/MultiSelectDropdown';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, LogarithmicScale);

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

const INTERVALS = [
  { entry: 25, exit: 10 }, { entry: 25, exit: 25 }, { entry: 50, exit: 25 }, { entry: 50, exit: 50 },
  { entry: 75, exit: 25 }, { entry: 75, exit: 50 }, { entry: 75, exit: 75 },
  { entry: 100, exit: 25 }, { entry: 100, exit: 50 }, { entry: 100, exit: 100 },
  { entry: 150, exit: 50 }, { entry: 150, exit: 75 }, { entry: 150, exit: 100 }, { entry: 150, exit: 150 },
  { entry: 200, exit: 25 }, { entry: 200, exit: 50 }, { entry: 200, exit: 100 }, { entry: 200, exit: 200 },
].sort((a, b) => a.entry - b.entry || a.exit - b.exit);

const strategyKeys = INTERVALS.flatMap(({ entry, exit }) => [`mom_${entry}_${exit}`, `donch_${entry}_${exit}`, `time_${entry}_${exit}`]);
type StrategyType = typeof strategyKeys[number];

const STRATEGY_DESCRIPTIONS = Object.fromEntries(
  INTERVALS.flatMap(({ entry, exit }) => [
    [`mom_${entry}_${exit}`, `Portfolio Long: Asset entry if Close > ${entry}d close benchmark. Exit on ${exit}d breakdown layers.`],
    [`donch_${entry}_${exit}`, `Portfolio Breakout: Enter asset on ${entry}-day Highest Close. Exit on ${exit}-day Lowest Close.`],
    [`time_${entry}_${exit}`, `Portfolio Momentum Strobe: Enter on ${entry}-day Highest Close. Stale exit after ${exit} days without matching extensions.`],
  ])
) as Record<StrategyType, string>;

// Dynamic matrix generation for individual historical years down to SPY foundation parameters
const START_YEARS_LIST = Array.from({ length: 2026 - 1993 + 1 }, (_, i) => (1993 + i).toString()).reverse();

const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`;

const BacktestChart = ({ data }: { data: any }) => {
  const chartData = {
    labels: data.dates,
    datasets: [{ 
      label: 'Portfolio Value', 
      data: data.strategyEquityCurve, 
      borderColor: '#4f46e5', 
      backgroundColor: 'rgba(79, 70, 229, 0.05)',
      pointRadius: 0,
      borderWidth: 2,
      fill: true
    }],
  };
  
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { y: { type: 'logarithmic' as const } }
  };

  return <div className="h-[400px] w-full"><Line options={options} data={chartData} /></div>;
};

export default function PortfolioTrendBacktesterPage() {
  const [tickerList, setTickerList] = useState<string[]>([]);
  const [selectedTickers, setSelectedTickers] = useState<string[]>(['SPY']);
  const [strategy, setStrategy] = useState<StrategyType>('mom_200_200');
  const [startYear, setStartYear] = useState('common'); // Defaulting directly to your "Oldest Common" logic profile
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('symbols').select('symbol').order('symbol', { ascending: true }).then(({ data }) => {
        if (data) setTickerList(data.map((r: any) => r.symbol));
    });
  }, []);

  const handleRunBacktest = async () => {
    if (selectedTickers.length === 0) { setError("Please select at least one asset for calculation."); return; }
    setLoading(true); setError(null); setResults(null);
    
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('portfolio-trend-strategies', {
        body: { tickers: selectedTickers, strategyType: strategy, startYear: startYear },
      });
      if (invokeError) throw new Error(invokeError.message);
      if (data.error) throw new Error(data.error);
      setResults(data);
    } catch (e: any) { 
      setError(e.message || "An error occurred during simulation matrix computation."); 
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8 font-sans text-slate-800">
      <main className="container mx-auto max-w-7xl bg-white p-6 rounded-lg shadow-xl border border-slate-200">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Portfolio Engine: Multi-Asset Trend Backtester</h1>
          <p className="text-slate-500 mt-2">Allocates $10,000 baseline capital per stock with 0.10% commission friction parameters.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 items-end gap-4 mb-4 p-6 bg-slate-100 rounded-xl border border-slate-200 shadow-sm">
          <div className="md:col-span-1">
            <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-bold text-slate-700 uppercase">Portfolio (Max 5)</label>
                <button type="button" onClick={() => setSelectedTickers([])} className="text-[10px] bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded hover:bg-red-200 transition-colors">Deselect All</button>
            </div>
            <MultiSelectDropdown 
              options={tickerList} 
              selected={selectedTickers} 
              onToggle={(t: string) => setSelectedTickers(prev => prev.includes(t) ? prev.filter(x => x !== t) : (prev.length < 5 ? [...prev, t] : prev))} 
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Timeline Sync</label>
            <select value={startYear} onChange={e => setStartYear(e.target.value)} className="w-full p-2 border border-gray-300 bg-white rounded-md text-sm font-semibold text-slate-800 cursor-pointer">
              <option value="all">All Years (Unhinged Start)</option>
              <option value="common">Oldest Common (Shortest Track Sync)</option>
              <hr />
              {START_YEARS_LIST.map(yr => (
                <option key={yr} value={yr}>Start Year: {yr}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-1">
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Execution Rule Matrix</label>
            <select value={strategy} onChange={e => setStrategy(e.target.value as StrategyType)} className="w-full p-2 border border-gray-300 bg-white rounded-md text-sm font-semibold text-slate-800 cursor-pointer">
              <optgroup label="Simple Momentum (Price vs. Price)">
                {INTERVALS.map(({ entry, exit }) => (
                  <option key={`mom_${entry}_${exit}`} value={`mom_${entry}_${exit}`}>{entry} Day / {exit} Day</option>
                ))}
              </optgroup>
              <optgroup label="Standard Donchian (High/Low Breakouts)">
                {INTERVALS.map(({ entry, exit }) => (
                  <option key={`donch_${entry}_${exit}`} value={`donch_${entry}_${exit}`}>{entry} Day Max / {exit} Day Min</option>
                ))}
              </optgroup>
              <optgroup label="Momentum Strobe (Time-Based Exits)">
                {INTERVALS.map(({ entry, exit }) => (
                  <option key={`time_${entry}_${exit}`} value={`time_${entry}_${exit}`}>{entry} Day Max / {exit} Day Stop</option>
                ))}
              </optgroup>
            </select>
          </div>
          <button onClick={handleRunBacktest} disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-md transition shadow-md disabled:bg-slate-300">
            {loading ? "Computing Matrices..." : "Run Portfolio Simulation"}
          </button>
        </div>

        <div className="mb-6 p-4 bg-indigo-50 border-l-4 border-indigo-500 rounded text-indigo-900 text-sm font-medium transition-all">
          <strong>Active Parameters Execution Profile:</strong> {STRATEGY_DESCRIPTIONS[strategy]}
        </div>

        {error && <div className="p-4 bg-red-50 text-red-700 rounded border border-red-200 font-bold mb-6">{error}</div>}

        {results && (
          <div className="space-y-6">
            <div className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm h-[450px]">
              <BacktestChart data={results} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border border-slate-200 rounded-xl p-6 bg-white shadow-sm flex flex-col justify-center">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider border-b pb-2 mb-4">Performance Summary</h3>
                <div className="space-y-3 text-base font-semibold">
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-slate-500">Total Return:</span>
                    <span className={results.strategyTotalReturn >= 0 ? "text-green-600 font-bold" : "text-red-600 font-bold"}>{formatPercent(results.strategyTotalReturn)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Max Drawdown:</span>
                    <span className="text-red-600 font-bold">{formatPercent(results.strategyMaxDrawdown)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}