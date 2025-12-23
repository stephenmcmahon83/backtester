// FILE: app/portfolio-momentum/page.tsx

"use client";

import React, { useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
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
  LogarithmicScale
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

type BacktestResult = {
  strategy_metrics: { cagr: number; total_return: number; max_drawdown: number; sharpe_ratio: number; };
  benchmark_metrics: { cagr: number; total_return: number; max_drawdown: number; sharpe_ratio: number; };
  cumulative_returns: { date: string; strategy: number; benchmark: number; }[];
  monthly_holdings: { date: string; holdings: string[]; }[];
  holdings_distribution: { ticker: string; percentage: number; }[];
};

export default function MomentumPage() {
  const supabase = createSupabaseBrowserClient();

  const [tickers, setTickers] = useState("SPY,TLT,GLD,EEM");
  const [lookbackMonths, setLookbackMonths] = useState(3);
  const [topN, setTopN] = useState(1);
  const [startYear, setStartYear] = useState(2007);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<BacktestResult | null>(null);

  const handleRunBacktest = async () => {
    if (!tickers.trim()) {
      setError("Please enter at least one ticker symbol.");
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const tickerList = tickers.split(',').map(t => t.trim().toUpperCase()).filter(t => t.length > 0);
      
      if (tickerList.length < 2) {
        throw new Error("Please enter at least 2 tickers for comparison.");
      }

      const { data, error } = await supabase.functions.invoke('momentum-backtest', {
        body: {
          tickers: tickerList,
          lookback_months: lookbackMonths,
          top_n: topN,
          start_year: startYear
        }
      });
      
      if (error) throw new Error(error.message);
      if (!data) throw new Error('No data returned from backtest.');
      if (data.error) throw new Error(data.error);

      setResults(data);
    } catch (e: any) {
      console.error("Backtest failed:", e);
      setError(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`;
  const formatPercentColor = (value: number) => {
    const color = value >= 0 ? 'text-green-700' : 'text-red-700';
    const sign = value >= 0 ? '+' : '';
    return <span className={`${color} font-semibold`}>{sign}{formatPercent(value)}</span>;
  };

  const chartData = results ? {
    labels: results.cumulative_returns.map(r => r.date),
    datasets: [
      {
        label: `Strategy (CAGR: ${formatPercent(results.strategy_metrics.cagr)})`,
        data: results.cumulative_returns.map(r => r.strategy),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        borderWidth: 2,
        pointRadius: 0,
      },
      {
        label: `Buy & Hold SPY (CAGR: ${formatPercent(results.benchmark_metrics.cagr)})`,
        data: results.cumulative_returns.map(r => r.benchmark),
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.5)',
        borderWidth: 2,
        pointRadius: 0,
      }
    ]
  } : null;

  const chartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: { type: 'logarithmic', title: { display: true, text: 'Cumulative Returns (Log Scale)' } },
      x: { title: { display: true, text: 'Date' }, ticks: { maxTicksLimit: 15 } }
    },
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: 'Momentum Rotation Strategy vs. Buy & Hold SPY', font: { size: 16 } }
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 font-sans">
      <main className="container mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col items-center">
          {/* Input Section */}
          <div className="w-full max-w-4xl bg-white p-6 rounded-lg shadow-md mb-8">
            <h1 className="text-2xl font-bold text-center mb-4 text-gray-800">
              Momentum Rotation Strategy Backtest
            </h1>
            <div className="text-sm text-gray-600 mb-6 space-y-2">
              <p>This strategy rotates monthly into the top-performing assets based on recent momentum. At the end of each month, it calculates the return over the lookback period and invests equally in the top N performers for the next month.</p>
              <p className="font-semibold">All results use dividend/split-adjusted prices and account for a 0.01% round-trip commission per trade.</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tickers (comma-separated)</label>
                <input type="text" value={tickers} onChange={(e) => setTickers(e.target.value)} placeholder="SPY,TLT,GLD,EEM" className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                <p className="text-xs text-gray-500 mt-1">Example: SPY,TLT,GLD,EEM (default momentum rotation universe)</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Lookback (Months)</label>
                  <input type="number" value={lookbackMonths} onChange={(e) => setLookbackMonths(parseInt(e.target.value))} min="1" max="12" className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Hold Top N</label>
                  <input type="number" value={topN} onChange={(e) => setTopN(parseInt(e.target.value))} min="1" max="10" className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Year</label>
                  <input type="number" value={startYear} onChange={(e) => setStartYear(parseInt(e.target.value))} min="1980" max={new Date().getFullYear()} className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
              </div>
              <button onClick={handleRunBacktest} disabled={loading} className="w-full px-4 py-3 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition-colors">
                {loading ? "Running Backtest..." : "Run Backtest"}
              </button>
            </div>
            {error && <p className="text-red-500 mt-4 text-center font-semibold">{error}</p>}
          </div>

          {/* Results Section */}
          {results && !loading && (
            <div className="w-full max-w-6xl space-y-8">
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-bold mb-4 text-gray-800">Performance Metrics</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                    <h3 className="text-lg font-semibold mb-3 text-blue-900">Momentum Rotation Strategy</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between"><span className="text-gray-700">CAGR:</span>{formatPercentColor(results.strategy_metrics.cagr)}</div>
                      <div className="flex justify-between"><span className="text-gray-700">Total Return:</span>{formatPercentColor(results.strategy_metrics.total_return)}</div>
                      <div className="flex justify-between"><span className="text-gray-700">Max Drawdown:</span>{formatPercentColor(results.strategy_metrics.max_drawdown)}</div>
                      <div className="flex justify-between"><span className="text-gray-700">Sharpe Ratio:</span><span className="font-semibold">{results.strategy_metrics.sharpe_ratio.toFixed(2)}</span></div>
                    </div>
                  </div>
                  <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <h3 className="text-lg font-semibold mb-3 text-gray-900">Buy & Hold SPY (Benchmark)</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between"><span className="text-gray-700">CAGR:</span>{formatPercentColor(results.benchmark_metrics.cagr)}</div>
                      <div className="flex justify-between"><span className="text-gray-700">Total Return:</span>{formatPercentColor(results.benchmark_metrics.total_return)}</div>
                      <div className="flex justify-between"><span className="text-gray-700">Max Drawdown:</span>{formatPercentColor(results.benchmark_metrics.max_drawdown)}</div>
                      <div className="flex justify-between"><span className="text-gray-700">Sharpe Ratio:</span><span className="font-semibold">{results.benchmark_metrics.sharpe_ratio.toFixed(2)}</span></div>
                    </div>
                  </div>
                </div>
              </div>

              {chartData && (
                <div className="bg-white p-6 rounded-lg shadow-md">
                  <div style={{ height: '500px' }}>
                    <Line data={chartData} options={chartOptions} />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-lg shadow-md">
                  <h2 className="text-xl font-bold mb-4 text-gray-800">Asset Holding Distribution</h2>
                  <p className="text-sm text-gray-600 mb-4">Percentage of time each asset was held:</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {results.holdings_distribution.map((item) => (
                      <div key={item.ticker} className="border border-gray-200 rounded-lg p-4 text-center">
                        <div className="text-lg font-bold text-gray-800">{item.ticker}</div>
                        <div className="text-2xl font-semibold text-blue-600">{(item.percentage * 100).toFixed(1)}%</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-md">
                  <h2 className="text-xl font-bold mb-4 text-gray-800">Monthly Holdings History</h2>
                  <div className="overflow-auto max-h-96 border border-gray-200 rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-100 sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Month</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Holdings</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {results.monthly_holdings.slice().reverse().map((item, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">{item.date}</td>
                            <td className="px-4 py-2 text-sm text-gray-900">{item.holdings.join(', ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}