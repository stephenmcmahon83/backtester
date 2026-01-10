"use client";

import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
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

  // --- STATE ---
  const [selectedTickers, setSelectedTickers] = useState<string[]>(["SPY", "TLT", "GLD", "EEM"]);
  const [availableSymbols, setAvailableSymbols] = useState<string[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [lookbackMonths, setLookbackMonths] = useState(3);
  const [topN, setTopN] = useState(1);
  const [startYear, setStartYear] = useState(2007);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<BacktestResult | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // --- 1. Fetch Available Symbols ---
  useEffect(() => {
    const fetchSymbols = async () => {
      const { data } = await supabase
        .from('symbols')
        .select('symbol')
        .order('symbol', { ascending: true });
      
      if (data) {
        setAvailableSymbols(data.map(d => d.symbol));
      }
    };
    fetchSymbols();

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- 2. Ticker Selection Logic ---
  const toggleTicker = (ticker: string) => {
    if (selectedTickers.includes(ticker)) {
      setSelectedTickers(prev => prev.filter(t => t !== ticker));
    } else {
      if (selectedTickers.length >= 6) return;
      setSelectedTickers(prev => [...prev, ticker]);
      setSearchTerm("");
    }
  };

  const removeTicker = (ticker: string) => {
    setSelectedTickers(prev => prev.filter(t => t !== ticker));
  };

  const filteredSymbols = availableSymbols.filter(sym => 
    sym.includes(searchTerm.toUpperCase()) && !selectedTickers.includes(sym)
  );

  // --- 3. Backtest Execution ---
  const handleRunBacktest = async () => {
    if (selectedTickers.length < 2) {
      setError("Please select at least 2 tickers for comparison.");
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const { data, error } = await supabase.functions.invoke('momentum-backtest', {
        body: {
          tickers: selectedTickers,
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

  // --- Helpers for formatting ---
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
    <>
      {/* SEO Meta Tags */}
      <Head>
        <title>Momentum Rotation Strategy Backtester | Asset Allocation & ETF Rotation</title>
        <meta 
          name="description" 
          content="Backtest momentum rotation strategies across multiple assets. Compare rotating into top performers vs buy-and-hold with customizable lookback periods and position sizing." 
        />
        <meta name="keywords" content="momentum rotation, asset allocation, ETF rotation, tactical allocation, relative strength, momentum strategy, portfolio backtester" />
        <meta name="robots" content="index, follow" />
      </Head>

      <div 
        className="min-h-screen bg-gray-100 font-sans"
        style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' } as React.CSSProperties}
      >
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
              
              <div className="space-y-6">
                
                {/* --- TICKER SELECTION DROPDOWN --- */}
                <div ref={dropdownRef} className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Tickers (Max 6) <span className="text-blue-600 font-bold">{selectedTickers.length}/6</span>
                  </label>
                  
                  <div 
                    className="min-h-[50px] p-2 border border-gray-300 rounded-md bg-white flex flex-wrap gap-2 items-center cursor-text focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500"
                    onClick={() => setIsDropdownOpen(true)}
                  >
                    {selectedTickers.map(ticker => (
                      <div key={ticker} className="bg-blue-100 text-blue-800 text-sm font-semibold px-2 py-1 rounded-md flex items-center gap-1">
                        {ticker}
                        <button 
                          onClick={(e) => { e.stopPropagation(); removeTicker(ticker); }}
                          className="text-blue-600 hover:text-blue-900 focus:outline-none"
                        >
                          ×
                        </button>
                      </div>
                    ))}

                    <input 
                      type="text" 
                      className="flex-grow min-w-[100px] outline-none text-sm text-gray-700 placeholder-gray-400 bg-transparent"
                      placeholder={selectedTickers.length < 6 ? "Type to search..." : ""}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onFocus={() => setIsDropdownOpen(true)}
                      disabled={selectedTickers.length >= 6}
                      style={{ userSelect: 'text', WebkitUserSelect: 'text' } as React.CSSProperties}
                    />
                  </div>

                  {isDropdownOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {filteredSymbols.length === 0 ? (
                        <div className="p-3 text-sm text-gray-500 text-center">No matching symbols found</div>
                      ) : (
                        filteredSymbols.map(sym => (
                          <div 
                            key={sym}
                            onClick={() => toggleTicker(sym)}
                            className="px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 cursor-pointer transition-colors"
                          >
                            {sym}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                  {selectedTickers.length >= 6 && (
                     <p className="text-xs text-orange-500 mt-1">Maximum of 6 symbols reached.</p>
                  )}
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

                {/* --- EDUCATIONAL CONTENT SECTION --- */}
                <section className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Understanding Momentum Rotation Strategies</h2>
                  
                  <div className="prose prose-gray max-w-none text-gray-700 space-y-4">
                    <p>
                      Momentum rotation is a tactical asset allocation approach based on a simple observation: assets that have performed well recently tend to continue performing well in the near future. Instead of holding a fixed portfolio forever, this strategy periodically ranks all available assets by their recent returns and rotates into the top performers. The idea is to ride trends while they last and switch to new leaders when the old ones start to fade.
                    </p>

                    <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">How the Strategy Works</h3>

                    <p>
                      At the end of each month, the strategy calculates the return of each asset over the lookback period you specify (e.g., 3 months). It then ranks them from best to worst and invests equally in the top N performers for the following month. If you set Top N to 1, you're going all-in on the single best performer—maximum concentration, maximum potential reward, but also maximum risk if that asset reverses. If you set Top N to 2 or 3, you're spreading across multiple leaders, which smooths returns but may dilute the strongest momentum.
                    </p>

                    <p>
                      The lookback period determines what counts as "recent" performance. A 3-month lookback captures intermediate-term trends; a 1-month lookback is more responsive but also more prone to whipsaws from short-term noise. A 6 or 12-month lookback captures longer trends but may be slow to react when conditions change. There's no universally "best" setting—it depends on the assets you're trading and the market environment.
                    </p>

                    <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">Understanding the Results</h3>

                    <p>
                      The <strong>CAGR (Compound Annual Growth Rate)</strong> shows the annualized return of the strategy over the entire backtest period. It's the most important number for comparing strategies—a 10% CAGR means your money doubled roughly every 7 years. <strong>Total Return</strong> shows the cumulative gain from start to finish, which can be dramatic over long periods but doesn't account for how long it took.
                    </p>

                    <p>
                      <strong>Max Drawdown</strong> is the worst peak-to-trough decline during the backtest—the biggest loss you would have experienced before recovering. A strategy with a 50% max drawdown means at some point your portfolio was cut in half from its previous high. This matters for real-world trading because drawdowns test your emotional resolve. Many people abandon strategies during drawdowns, locking in losses right before the recovery. <strong>Sharpe Ratio</strong> measures risk-adjusted returns—how much return you got per unit of volatility. Higher is better; above 1.0 is generally considered good.
                    </p>

                    <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">The Equity Curve and Holdings</h3>

                    <p>
                      The chart compares your momentum rotation strategy (blue) to a simple buy-and-hold position in SPY (red). Both curves are plotted on a logarithmic scale so that percentage moves look proportional regardless of the dollar amount. Pay attention not just to which line ends higher, but to the path along the way. A strategy that beats buy-and-hold but with gut-wrenching volatility may be harder to stick with in practice.
                    </p>

                    <p>
                      The <strong>Asset Holding Distribution</strong> shows what percentage of the backtest period each asset spent in the portfolio. If one asset dominates (say, 60% of the time), it means that asset was frequently the momentum leader. If holdings are spread evenly, the strategy rotated frequently between assets. The <strong>Monthly Holdings History</strong> table shows exactly which assets were held each month, letting you audit the strategy's decisions and see how it responded to different market conditions.
                    </p>

                    <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">Choosing Your Asset Universe</h3>

                    <p>
                      The assets you include in the rotation matter enormously. A classic setup uses uncorrelated asset classes—like stocks (SPY), bonds (TLT), gold (GLD), and emerging markets (EEM)—so that there's usually at least one asset trending up even when others are struggling. This "all-weather" approach aims to capture upside wherever it appears. Alternatively, you could rotate among sector ETFs or individual stocks, though this increases correlation and may lead to the strategy being fully invested in equities during a broad market crash.
                    </p>

                    <p>
                      Keep in mind that backtested results are hypothetical. They assume you could have executed at month-end prices with no slippage, and they don't account for the psychological difficulty of selling your winners to buy something that just dropped (the opposite of what feels comfortable). The 0.01% commission assumption is minimal—real-world costs including spreads may be higher. Use this tool to understand how momentum rotation behaves with different parameters, but don't assume past performance will repeat exactly in the future.
                    </p>
                  </div>
                </section>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}