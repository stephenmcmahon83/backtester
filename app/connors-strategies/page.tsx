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
type StrategyType =
  | 'rsi-4' | 'r3' | 'pct-b' | 'multi-day' | 'rsi-10-6'
  | '3-low-high' | '5-low-high' | '10-low-high';

type BacktestResults = {
  dates: string[]; strategyEquityCurve: number[]; strategyTotalReturn: number;
  strategyMaxDrawdown: number; profitableYearsPct: number; isHolding: boolean;
  pendingAction: 'BUY' | 'SELL' | 'NONE'; totalTrades: number; winRate: number;
  avgReturnAfterWin: number; winRateAfterWin: number; avgReturnAfterLoss: number;
  winRateAfterLoss: number;
  trades: {
    entryDate: string; exitDate: string; entryPrice: number;
    exitPrice: number; return: number;
  }[];
  yearlyStats: {
    year: string; return: number; count: number; winRate: number;
  }[];
};

const STRATEGY_DESCRIPTIONS: Record<StrategyType, string> = {
  'rsi-4': "Enter if RSI(4) < 25. Exit when RSI(4) crosses 55.",
  'r3': "Enter if RSI(2) decreases 3 days in a row & < 10. Exit at RSI > 70.",
  'pct-b': "Enter if Bollinger %B < 0.2. Exit when %B crosses 0.8.",
  'multi-day': "Enter if Close is lower for 4 of last 5 days. Exit on SMA(5) cross.",
  'rsi-10-6': "Enter if RSI(2) was < 10 yesterday and < 6 today. Exit on SMA(5) cross.",
  '3-low-high': "Enter on new 3-day low (if > 200 SMA). Exit on new 3-day high.",
  '5-low-high': "Enter on new 5-day low (if > 200 SMA). Exit on new 5-day high.",
  '10-low-high': "Enter on new 10-day low (if > 200 SMA). Exit on new 10-day high."
};

const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`;
const formatWholePercent = (value: number) => `${Math.round(value * 100)}%`;

const BacktestChart = ({ data, title }: { data: BacktestResults, title: string }) => {
    const chartData = {
        labels: data.dates,
        datasets: [{
            label: 'Strategy Equity', data: data.strategyEquityCurve,
            borderColor: 'rgb(79, 70, 229)', backgroundColor: 'rgba(79, 70, 229, 0.5)',
            pointRadius: 0, borderWidth: 2,
        }],
    };
    const options = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, title: { display: true, text: title, font: { size: 18 } } },
        scales: { y: { type: 'logarithmic' as const, ticks: { callback: (value: any) => `$${Number(value).toLocaleString()}` } } }
    };
    return <div className="h-[400px] w-full"><Line options={options} data={chartData} /></div>;
};

export default function MeanReversionPage() {
  const [tickerList, setTickerList] = useState<string[]>([]);
  const [selectedTicker, setSelectedTicker] = useState<string>('SPY');
  const [strategy, setStrategy] = useState<StrategyType>('3-low-high');
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
      const { data, error: invokeError } = await supabase.functions.invoke('connors-strategies', {
        body: { 
          ticker: selectedTicker.toUpperCase(),
          strategyType: strategy,
          startYear: startYear,
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

  const avgTradeReturn = results && results.totalTrades > 0
    ? results.trades.reduce((sum, t) => sum + t.return, 0) / results.totalTrades
    : 0;

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-8 font-sans text-gray-900">
      <main className="container mx-auto max-w-7xl bg-white p-6 rounded-lg shadow-xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-extrabold text-gray-900">Mean Reversion Backtester</h1>
          <p className="text-gray-500 mt-2">Trades execute at Next Day Open and includes 0.10% round-trip commission. Assumes profits are reinvested.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 items-end gap-4 mb-8 p-6 bg-slate-50 rounded-xl border border-slate-200 shadow-sm">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Ticker</label>
            {loadingTickers ? <div className="h-10 w-full bg-gray-200 rounded animate-pulse"></div> : (
              <select 
                value={selectedTicker} 
                onChange={(e) => setSelectedTicker(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 bg-white outline-none cursor-pointer"
              >
                {tickerList.map(ticker => (<option key={ticker} value={ticker}>{ticker}</option>))}
              </select>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Start Year</label>
            <select value={startYear} onChange={(e) => setStartYear(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 bg-white outline-none cursor-pointer">
              {yearOptions.map(year => ( <option key={year} value={year}>{year === 'all' ? 'All Data' : year}</option>))}
            </select>
          </div>

          <div className="md:col-span-1">
            <label className="block text-sm font-bold text-gray-700 mb-1">Strategy</label>
            <select value={strategy} onChange={(e) => setStrategy(e.target.value as StrategyType)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 bg-white outline-none cursor-pointer">
              <option value="rsi-4">RSI(4) Extremes</option>
              <option value="r3">R3 Method (RSI-2 Streak)</option>
              <option value="pct-b">Bollinger %B</option>
              <option value="multi-day">Multi-Day Down</option>
              <option value="rsi-10-6">RSI(2) 10/6 Crash</option>
              <option value="3-low-high">3-Day Low/High</option>
              <option value="5-low-high">5-Day Low/High</option>
              <option value="10-low-high">10-Day Low/High</option>
            </select>
          </div>

          <div>
            <button onClick={handleRunBacktest} disabled={loading || loadingTickers || !selectedTicker}
              className="w-full px-8 py-2 bg-indigo-600 text-white font-bold rounded-md hover:bg-indigo-700 disabled:bg-gray-400 transition-colors shadow-md">
              Run Backtest
            </button>
          </div>
        </div>
        
        <div className="mb-8 p-4 bg-indigo-50 border-l-4 border-indigo-500 rounded-r-md text-indigo-900 text-sm">
          <span className="font-bold">Logic:</span> {STRATEGY_DESCRIPTIONS[strategy]}
        </div>

        {error && (<div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 text-red-700" role="alert"><p className="font-bold">Error</p><p>{error}</p></div>)}
        
        {results && (
          <div className="space-y-12 animate-fade-in">
            <div className="p-4 border border-gray-200 rounded-lg bg-white shadow-md">
              <BacktestChart data={results} title={`Performance for ${selectedTicker.toUpperCase()} - ${strategy.replace(/-/g, ' ').toUpperCase()}`} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                    <h2 className="text-xl font-bold mb-4 text-gray-800 border-b pb-2">Performance Summary</h2>
                    <div className="overflow-hidden border border-gray-200 rounded-lg shadow-sm mb-8">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                           {/* Table content adapted from example */}
                           <thead className="bg-gray-50"><tr><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Metric</th><th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Result</th></tr></thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                <tr><td className="px-4 py-3 font-medium text-gray-900">Total Return</td><td className={`px-4 py-3 text-right font-bold ${results.strategyTotalReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatWholePercent(results.strategyTotalReturn)}</td></tr>
                                <tr><td className="px-4 py-3 font-medium text-gray-900">Max Drawdown</td><td className="px-4 py-3 text-right text-red-600 font-medium">{formatWholePercent(results.strategyMaxDrawdown)}</td></tr>
                                <tr><td className="px-4 py-3 font-medium text-gray-900">% Profitable Years</td><td className="px-4 py-3 text-right text-gray-700 font-medium">{formatWholePercent(results.profitableYearsPct)}</td></tr>
                                
                                <tr className="bg-gray-50"><td colSpan={2} className="px-4 py-2 text-xs font-bold text-gray-500 uppercase">Current Status</td></tr>
                                <tr><td className="px-4 py-3 font-medium text-gray-900">Position</td><td className={`px-4 py-3 text-right font-bold ${results.isHolding ? 'text-blue-600' : 'text-gray-400'}`}>{results.isHolding ? "IN POSITION" : "CASH"}</td></tr>
                                <tr><td className="px-4 py-3 font-medium text-gray-900">Signal for Tomorrow</td><td className={`px-4 py-3 text-right font-bold ${results.pendingAction === 'BUY' ? 'text-green-600' : results.pendingAction === 'SELL' ? 'text-red-600' : 'text-gray-400'}`}>{results.pendingAction}</td></tr>
                                
                                <tr className="bg-gray-50"><td colSpan={2} className="px-4 py-2 text-xs font-bold text-gray-500 uppercase">Trade Stats</td></tr>
                                <tr><td className="px-4 py-3 font-medium text-gray-900">Avg Return / Trade</td><td className={`px-4 py-3 text-right ${avgTradeReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatPercent(avgTradeReturn)}</td></tr>
                                <tr><td className="px-4 py-3 font-medium text-gray-900">% Profitable Trades</td><td className="px-4 py-3 text-right text-gray-700">{formatWholePercent(results.winRate)}</td></tr>
                                <tr><td className="px-4 py-3 font-medium text-gray-900">Avg Return after Win</td><td className={`px-4 py-3 text-right ${results.avgReturnAfterWin >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatPercent(results.avgReturnAfterWin)}</td></tr>
                                <tr><td className="px-4 py-3 font-medium text-gray-900">% Profitable after Win</td><td className="px-4 py-3 text-right text-gray-700">{formatWholePercent(results.winRateAfterWin)}</td></tr>
                                <tr><td className="px-4 py-3 font-medium text-gray-900">Avg Return after Loss</td><td className={`px-4 py-3 text-right ${results.avgReturnAfterLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatPercent(results.avgReturnAfterLoss)}</td></tr>
                                <tr><td className="px-4 py-3 font-medium text-gray-900">% Profitable after Loss</td><td className="px-4 py-3 text-right text-gray-700">{formatWholePercent(results.winRateAfterLoss)}</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                <div>
                    <h2 className="text-xl font-bold mb-4 text-gray-800 border-b pb-2">Yearly Performance</h2>
                    <div className="overflow-auto max-h-[500px] border border-gray-200 rounded-lg shadow-sm">
                        <table className="min-w-full divide-y divide-gray-200 relative">
                            <thead className="bg-gray-50 sticky top-0 shadow-sm z-10"><tr><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Year</th><th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Return</th><th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Win Rate</th><th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase"># Trades</th></tr></thead>
                            <tbody className="bg-white divide-y divide-gray-200 text-sm">
                            {results.yearlyStats.map((stat) => (<tr key={stat.year} className="hover:bg-gray-50"><td className="px-4 py-3 font-bold text-gray-900">{stat.year}</td><td className={`px-4 py-3 text-right font-bold ${stat.return >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatPercent(stat.return)}</td><td className="px-4 py-3 text-right text-gray-700">{formatWholePercent(stat.winRate)}</td><td className="px-4 py-3 text-right text-gray-700">{stat.count}</td></tr>))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-4 text-center text-gray-800">Trade Log</h2>
              <div className="overflow-auto h-[500px] border border-gray-200 rounded-lg shadow-sm">
                <table className="min-w-full divide-y divide-gray-200 relative">
                  <thead className="bg-gray-50 sticky top-0 shadow-sm z-10"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entry Date</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Exit Date</th><th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Entry ($)</th><th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Exit ($)</th><th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Return</th></tr></thead>
                  <tbody className="bg-white divide-y divide-gray-200 text-sm">
                    {results.trades.slice().reverse().map((trade, index) => (<tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-gray-700">{trade.entryDate}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-700">{trade.exitDate}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-gray-700">{trade.entryPrice.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-gray-700">{trade.exitPrice.toFixed(2)}</td>
                      <td className={`px-6 py-4 whitespace-nowrap text-right font-bold ${trade.return >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatPercent(trade.return)}</td>
                    </tr>))}
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