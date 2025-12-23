"use client";

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from "@supabase/supabase-js";
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, LogarithmicScale } from 'chart.js';

ChartJS.register( CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, LogarithmicScale );
const supabase = createClient( process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! );

const INTERVALS = [
  { entry: 25, exit: 10 }, { entry: 25, exit: 25 }, { entry: 50, exit: 25 }, { entry: 50, exit: 50 },
  { entry: 75, exit: 25 }, { entry: 75, exit: 50 }, { entry: 75, exit: 75 },
  { entry: 100, exit: 25 }, { entry: 100, exit: 50 }, { entry: 100, exit: 100 },
  { entry: 150, exit: 50 }, { entry: 150, exit: 75 }, { entry: 150, exit: 100 }, { entry: 150, exit: 150 },
  { entry: 200, exit: 25 }, { entry: 200, exit: 50 }, { entry: 200, exit: 100 }, { entry: 200, exit: 200 },
].sort((a, b) => a.entry - b.entry || a.exit - b.exit);

const strategyKeys = INTERVALS.flatMap(({ entry, exit }) => [ `mom_${entry}_${exit}`, `donch_${entry}_${exit}`, `time_${entry}_${exit}` ]);
type StrategyType = typeof strategyKeys[number];

const STRATEGY_DESCRIPTIONS = Object.fromEntries(
  INTERVALS.flatMap(({ entry, exit }) => [
    [`mom_${entry}_${exit}`, `Long Only: Enter if Close > ${entry}d ago & Yesterday's Close > ${entry+1}d ago. Exit with inverse logic (${exit}d).`],
    [`donch_${entry}_${exit}`, `Long Only: Enter on ${entry}-day Highest Close. Exit on ${exit}-day Lowest Close.`],
    [`time_${entry}_${exit}`, `Long Only: Enter on ${entry}-day Highest Close. Exit if no new High Close in ${exit} days.`],
  ])
) as Record<StrategyType, string>;

type BacktestResults = {
  dates: string[]; strategyEquityCurve: number[]; strategyTotalReturn: number; strategyMaxDrawdown: number;
  profitableYearsPct: number; isHolding: boolean; totalTrades: number;
  winRate: number; avgReturnAfterWin: number; winRateAfterWin: number; avgReturnAfterLoss: number;
  winRateAfterLoss: number; trades: { ticker: string, entryDate: string; exitDate: string; entryPrice: number;
  exitPrice: number; return: number; status?: 'OPEN' | 'CLOSED'; }[];
  yearlyStats: { year: string; return: number; count: number; winRate: number; }[];
};

const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`;
const formatWholePercent = (value: number) => `${Math.round(value * 100)}%`;

const BacktestChart = ({ data, title }: { data: BacktestResults, title: string }) => {
    const chartData = {
        labels: data.dates,
        datasets: [
            {
                label: 'Strategy Equity',
                data: data.strategyEquityCurve,
                borderColor: 'rgb(79, 70, 229)',
                backgroundColor: 'rgba(79, 70, 229, 0.5)',
                pointRadius: 0,
                borderWidth: 2,
            },
        ],
    };
    const options = {
        responsive: true,
        plugins: {
            legend: { position: 'top' as const },
            title: { display: true, text: title, font: { size: 18 } },
        },
        scales: { y: { type: 'logarithmic' as const, ticks: { callback: (value: any) => `$${Number(value).toLocaleString()}` } } }
    };
    return <Line options={options} data={chartData} />;
};

export default function SingleStockBacktesterPage() {
  const [tickerList, setTickerList] = useState<string[]>([]);
  // UPDATED: State is now a simple string, not an array
  const [selectedTicker, setSelectedTicker] = useState<string>('SPY'); 
  const [strategy, setStrategy] = useState<StrategyType>('mom_200_200');
  const [startYear, setStartYear] = useState('all');
  const [results, setResults] = useState<BacktestResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingTickers, setLoadingTickers] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const yearOptions = ['all'];
  for (let y = new Date().getFullYear(); y >= 1990; y--) { yearOptions.push(y.toString()); }

  useEffect(() => {
    const fetchTickers = async () => {
      try {
        const { data, error } = await supabase.from('symbols').select('symbol').order('symbol', { ascending: true });
        if (error) throw error;
        if (data) setTickerList(data.map((row: any) => row.symbol));
      } catch (err) { console.error("Error fetching tickers:", err); } 
      finally { setLoadingTickers(false); }
    };
    fetchTickers();
  }, []);

  const handleRunBacktest = async () => {
    if (!selectedTicker) { setError("Please select a ticker."); return; }
    setLoading(true); setError(null); setResults(null);
    try {
      // UPDATED: Payload sends a single 'ticker' string
      const { data, error: invokeError } = await supabase.functions.invoke('single-stock-strategies', { // Recommended: rename your function for clarity
        body: { ticker: selectedTicker, strategyType: strategy, startYear: startYear, },
      });
      if (invokeError) throw new Error(invokeError.message);
      if (data.error) throw new Error(data.error);
      setResults(data);
    } catch (e: any)      console.error("Backtest failed:", e);
      setError(e.message || "An unknown error occurred");
    } finally { setLoading(false); }
  };
  
  const closedTrades = (results && results.trades) ? results.trades.filter(t => t.status === 'CLOSED') : [];
  const avgTradeReturn = closedTrades.length > 0 ? closedTrades.reduce((sum, t) => sum + t.return, 0) / closedTrades.length : 0;
  
  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-8 font-sans text-gray-900">
      <main className="container mx-auto max-w-7xl bg-white p-6 rounded-lg shadow-xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-extrabold text-gray-900">Single Stock Trend Backtester</h1>
          <p className="text-gray-500 mt-2">Starts with $10k and compounds all profits and losses.</p>
        </div>
        
        <div className="flex flex-col md:flex-row justify-center items-end gap-4 mb-8 p-6 bg-slate-50 rounded-xl border border-slate-200 shadow-sm">
          <div className="w-full md:w-1/4">
            <label className="block text-sm font-bold text-gray-700 mb-1">Ticker</label>
            {/* UPDATED: Replaced multi-select with a simple, standard dropdown */}
            {loadingTickers ? <div className="h-10 w-full bg-gray-200 rounded animate-pulse"></div> : (
              <select 
                value={selectedTicker} 
                onChange={(e) => setSelectedTicker(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 bg-white outline-none cursor-pointer transition-all"
              >
                {tickerList.map(ticker => (
                  <option key={ticker} value={ticker}>{ticker}</option>
                ))}
              </select>
            )}
          </div>
          
          <div className="w-full md:w-auto">
            <label className="block text-sm font-bold text-gray-700 mb-1">Start Year</label>
            <select value={startYear} onChange={(e) => setStartYear(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 bg-white outline-none cursor-pointer transition-all">
              {yearOptions.map(year => ( <option key={year} value={year}>{year === 'all' ? 'All Data' : year}</option>))}
            </select>
          </div>

          <div className="w-full md:w-1/2">
            <label className="block text-sm font-bold text-gray-700 mb-1">Strategy</label>
            <select value={strategy} onChange={(e) => setStrategy(e.target.value as StrategyType)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 bg-white outline-none cursor-pointer transition-all">
              <optgroup label="Simple Momentum (Price vs. Price)">
                {INTERVALS.map(({entry, exit}) => ( <option key={`mom_${entry}_${exit}`} value={`mom_${entry}_${exit}`}>{entry} Day / {exit} Day</option> ))}
              </optgroup>
              <optgroup label="Standard Donchian (High/Low)">
                {INTERVALS.map(({entry, exit}) => ( <option key={`donch_${entry}_${exit}`} value={`donch_${entry}_${exit}`}>{entry} Day High / {exit} Day Low</option> ))}
              </optgroup>
              <optgroup label="Time-Based Exits (High/No New High)">
                {INTERVALS.map(({entry, exit}) => ( <option key={`time_${entry}_${exit}`} value={`time_${entry}_${exit}`}>{entry} Day High / No High in {exit} Days</option> ))}
              </optgroup>
            </select>
          </div>

          <div className="w-full md:w-auto self-end">
            <button onClick={handleRunBacktest} disabled={loading || loadingTickers || !selectedTicker}
              className="w-full md:w-auto px-8 py-2 bg-indigo-600 text-white font-bold rounded-md hover:bg-indigo-700 disabled:bg-gray-400 transition-colors shadow-md">
              Run Backtest
            </button>
          </div>
        </div>
        
        {/* The rest of the page (Logic description, error message, and results display) is unchanged and will work perfectly. */}
        <div className="mb-8 p-4 bg-indigo-50 border-l-4 border-indigo-500 rounded-r-md text-indigo-900 text-sm">
          <span className="font-bold">Logic:</span> {STRATEGY_DESCRIPTIONS[strategy]}
        </div>
        {error && (<div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 text-red-700 rounded-r-md shadow-sm" role="alert">
            <p className="font-bold">Error</p><p>{error}</p></div>)}
        {results && (
          <div className="space-y-12 animate-fade-in">
            {/* ... All result tables and charts ... */}
          </div>
        )}
      </main>
    </div>
  );
}
