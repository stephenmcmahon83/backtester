"use client";

import React, { useState, useEffect, useRef } from 'react';
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

  // --- Enhanced Copy/Paste/Screenshot Protection ---
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) && 
        ['c', 'v', 'x', 'a', 'u', 's', 'p'].includes(e.key.toLowerCase())
      ) {
        e.preventDefault();
      }
      if (e.key === 'F12') {
        e.preventDefault();
      }
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
      {/* 
        JSON-LD SCHEMA
        Tells Google this is an Investment Strategy Tool.
      */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": "ETF Momentum Rotation Backtester",
            "applicationCategory": "FinanceApplication",
            "operatingSystem": "Web",
            "description": "A quantitative tool for backtesting relative strength and dual momentum strategies using ETFs like SPY, GLD, and TLT.",
            "offers": {
              "@type": "Offer",
              "price": "0",
              "priceCurrency": "USD"
            },
            "featureList": [
              "Relative Strength Ranking",
              "Monthly Rebalancing Simulator",
              "Portfolio Backtesting"
            ]
          })
        }}
      />

      <div 
        id="protected-content"
        className="min-h-screen bg-gray-100 font-sans"
        style={{ 
          userSelect: 'none', 
          WebkitUserSelect: 'none', 
          MozUserSelect: 'none', 
          msUserSelect: 'none',
          WebkitTouchCallout: 'none',
        } as React.CSSProperties}
      >
        <main className="container mx-auto px-4 sm:px-6 py-8">
          <div className="flex flex-col items-center">
            {/* Input Section */}
            <div className="w-full max-w-4xl bg-white p-6 rounded-lg shadow-md mb-8">
              <h1 className="text-2xl font-bold text-center mb-4 text-gray-800">
                ETF Momentum Rotation Backtester
              </h1>
              <div className="text-sm text-gray-600 mb-6 space-y-2">
                <p>This strategy rotates monthly into the top-performing assets based on <strong>Relative Strength</strong>. At the end of each month, it ranks assets by their return over the lookback period and invests in the winners.</p>
                <p className="font-semibold">All results include dividends and account for 0.01% trading commissions.</p>
              </div>
              
              <div className="space-y-6">
                
                {/* --- TICKER SELECTION DROPDOWN --- */}
                <div ref={dropdownRef} className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Assets (Max 6) <span className="text-blue-600 font-bold">{selectedTickers.length}/6</span>
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

                {/* --- EDUCATIONAL CONTENT SECTION (SEO OPTIMIZED) --- */}
                <section className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">What is Relative Strength Rotation?</h2>
                  
                  <div className="prose prose-gray max-w-none text-gray-700 space-y-4">
                    <p>
                      Momentum rotation (often called <strong>Relative Strength</strong>) is a tactical asset allocation strategy. It assumes that assets that have outperformed recently will continue to outperform in the near future. Instead of buying and holding, you periodically rank your potential assets (like SPY, TLT, and GLD) and switch your money into the strongest ones.
                    </p>

                    <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">How Dual Momentum Works</h3>

                    <p>
                      This simulator uses a classic &quot;Dual Momentum&quot; approach:
                    </p>
                    <ul className="list-disc pl-6">
                        <li><strong>Rank by Performance:</strong> At the end of each month, we calculate the return of every selected asset over the <strong>Lookback Period</strong> (e.g., 3 months).</li>
                        <li><strong>Rotate Capital:</strong> We invest equally in the <strong>Top N</strong> assets. If Top N is 1, we put 100% into the single best performer.</li>
                        <li><strong>Rebalance:</strong> We repeat this process every month. This ensures you are always holding the leaders and cutting the laggards.</li>
                    </ul>

                    <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">Why Rotate Between Stocks and Bonds?</h3>

                    <p>
                      A popular strategy involves rotating between unconnected assets like Stocks (SPY), Bonds (TLT), Gold (GLD), and Emerging Markets (EEM). This creates an &quot;All-Weather&quot; effect. When stocks crash, bonds or gold often rise. By rotating into the asset with the strongest 3-month or 6-month momentum, the strategy attempts to avoid prolonged bear markets by switching to safety assets automatically.
                    </p>

                    <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">Understanding the Backtest Results</h3>

                    <p>
                      <strong>CAGR</strong> (Compound Annual Growth Rate) tells you the average yearly return. <strong>Max Drawdown</strong> is crucial—it shows the pain point. A strategy might have high returns, but if it has a 50% drawdown, it is very hard to stick with. The <strong>Sharpe Ratio</strong> measures efficiency: returns per unit of risk. A Sharpe Ratio above 1.0 is generally considered excellent for a rotation strategy.
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