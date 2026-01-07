"use client";

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from "@supabase/supabase-js";
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, LogarithmicScale } from 'chart.js';
import Head from 'next/head';

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
  const [selectedTicker, setSelectedTicker] = useState<string>('SPY'); 
  const [strategy, setStrategy] = useState<StrategyType>('mom_200_200');
  const [startYear, setStartYear] = useState('all');
  const [results, setResults] = useState<BacktestResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingTickers, setLoadingTickers] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const yearOptions = ['all'];
  for (let y = new Date().getFullYear(); y >= 1990; y--) { yearOptions.push(y.toString()); }

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
      const { data, error: invokeError } = await supabase.functions.invoke('single-stock-strategies', {
        body: { ticker: selectedTicker, strategyType: strategy, startYear: startYear, },
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
  
  const closedTrades = (results && results.trades) ? results.trades.filter(t => t.status === 'CLOSED') : [];
  const avgTradeReturn = closedTrades.length > 0 ? closedTrades.reduce((sum, t) => sum + t.return, 0) / closedTrades.length : 0;
  
  return (
    <>
      {/* SEO Meta Tags */}
      <Head>
        <title>Single Stock Trend Backtester | Momentum & Donchian Channel Strategies</title>
        <meta 
          name="description" 
          content="Backtest trend-following strategies on individual stocks. Compare momentum breakouts, Donchian channel entries, and time-based exits with real historical data and commission costs." 
        />
        <meta name="keywords" content="trend following, momentum strategy, Donchian channel, breakout trading, stock backtester, trading system, technical analysis" />
        <meta name="robots" content="index, follow" />
      </Head>

      <div 
        className="min-h-screen bg-gray-100 p-4 sm:p-8 font-sans text-gray-900"
        style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' } as React.CSSProperties}
      >
        <main className="container mx-auto max-w-7xl bg-white p-6 rounded-lg shadow-xl">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-extrabold text-gray-900">Single Stock Trend Backtester</h1>
            <p className="text-gray-500 mt-2">Trades execute at Next Day Open and includes 0.10% round-trip commission. Assumes profits are reinvested.</p>
          </div>
          
          <div className="flex flex-col md:flex-row justify-center items-end gap-4 mb-8 p-6 bg-slate-50 rounded-xl border border-slate-200 shadow-sm">
            <div className="w-full md:w-1/4">
              <label className="block text-sm font-bold text-gray-700 mb-1">Ticker</label>
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
          
          <div className="mb-8 p-4 bg-indigo-50 border-l-4 border-indigo-500 rounded-r-md text-indigo-900 text-sm">
            <span className="font-bold">Logic:</span> {STRATEGY_DESCRIPTIONS[strategy]}
          </div>
          {error && (<div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 text-red-700 rounded-r-md shadow-sm" role="alert">
              <p className="font-bold">Error</p><p>{error}</p></div>)}
          {results && (
            <div className="space-y-12 animate-fade-in">
              <div className="p-4 border border-gray-200 rounded-lg bg-white shadow-md">
                <BacktestChart data={results} title={`Performance for ${selectedTicker} - ${strategy.replace(/_/g, ' ').toUpperCase()}`} />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div>
                      <h2 className="text-xl font-bold mb-4 text-gray-800 border-b pb-2">Performance Summary</h2>
                      <div className="overflow-hidden border border-gray-200 rounded-lg shadow-sm mb-8">
                          <table className="min-w-full divide-y divide-gray-200">
                             <thead className="bg-gray-50"><tr><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Overall</th><th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Result</th></tr></thead>
                              <tbody className="bg-white divide-y divide-gray-200 text-sm">
                                  <tr><td className="px-4 py-3 font-medium text-gray-900">Total Return</td><td className={`px-4 py-3 text-right font-bold ${results.strategyTotalReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatWholePercent(results.strategyTotalReturn)}</td></tr>
                                  <tr><td className="px-4 py-3 font-medium text-gray-900">Max Drawdown</td><td className="px-4 py-3 text-right text-red-600 font-medium">{formatWholePercent(results.strategyMaxDrawdown)}</td></tr>
                                  <tr><td className="px-4 py-3 font-medium text-gray-900">% Years Profitable</td><td className="px-4 py-3 text-right text-gray-700 font-medium">{formatWholePercent(results.profitableYearsPct)}</td></tr>
                                  <tr className="bg-gray-50"><td colSpan={2} className="px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider">Current Status</td></tr>
                                  <tr><td className="px-4 py-3 font-medium text-gray-900">Current Position</td><td className={`px-4 py-3 text-right font-bold ${results.isHolding ? 'text-blue-600' : 'text-gray-400'}`}>{results.isHolding ? "IN POSITION" : "CASH"}</td></tr>
                                  <tr className="bg-gray-50"><td colSpan={2} className="px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider">By Trade</td></tr>
                                  <tr><td className="px-4 py-3 font-medium text-gray-900">Avg Return</td><td className={`px-4 py-3 text-right ${avgTradeReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatPercent(avgTradeReturn)}</td></tr>
                                  <tr><td className="px-4 py-3 font-medium text-gray-900">% Profitable</td><td className="px-4 py-3 text-right text-gray-700">{formatWholePercent(results.winRate)}</td></tr>
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
                              <thead className="bg-gray-50 sticky top-0 shadow-sm z-10"><tr><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Year</th><th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Return</th><th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Win Rate</th><th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"># Trades</th></tr></thead>
                              <tbody className="bg-white divide-y divide-gray-200 text-sm">
                              {(results.yearlyStats || []).map((stat) => (<tr key={stat.year} className="hover:bg-gray-50"><td className="px-4 py-3 font-bold text-gray-900">{stat.year}</td><td className={`px-4 py-3 text-right font-bold ${stat.return >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatPercent(stat.return)}</td><td className="px-4 py-3 text-right text-gray-700">{formatWholePercent(stat.winRate)}</td><td className="px-4 py-3 text-right text-gray-700">{stat.count}</td></tr>))}
                              </tbody>
                          </table>
                      </div>
                  </div>
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-4 text-center text-gray-800">Trade Log</h2>
                <div className="overflow-auto h-[500px] border border-gray-200 rounded-lg shadow-sm">
                  <table className="min-w-full divide-y divide-gray-200 relative">
                    <thead className="bg-gray-50 sticky top-0 shadow-sm z-10"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ticker</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entry Date</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Exit Date</th><th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Entry ($)</th><th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Exit ($)</th><th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Return</th></tr></thead>
                    <tbody className="bg-white divide-y divide-gray-200 text-sm">
                      {(results.trades || []).slice().reverse().map((trade, index) => {
                          const isOpen = trade.status === 'OPEN';
                          return (<tr key={index} className={`${isOpen ? 'bg-blue-50' : 'hover:bg-gray-50'} transition-colors`}>
                              <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-800">{trade.ticker}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-gray-700">{trade.entryDate}</td>
                              <td className={`px-6 py-4 whitespace-nowrap ${isOpen ? 'font-bold text-blue-700' : 'text-gray-700'}`}>{isOpen ? 'OPEN' : trade.exitDate}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-gray-700">{trade.entryPrice.toFixed(2)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-gray-700">{trade.exitPrice.toFixed(2)}</td>
                              <td className={`px-6 py-4 whitespace-nowrap text-right font-bold ${trade.return >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatPercent(trade.return)}</td>
                          </tr>);
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* --- EDUCATIONAL CONTENT SECTION --- */}
              <section className="mt-12 bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">How the Trend-Following Strategies Work</h2>
                
                <div className="prose prose-gray max-w-none text-gray-700 space-y-4">
                  <p>
                    Trend following is one of the oldest and most studied approaches to systematic trading. The core idea is simple: markets tend to move in sustained directions for longer than random chance would predict. Rather than trying to pick tops and bottoms, a trend follower waits for confirmation that a move is underway, gets on board, and rides it until there's evidence the trend has reversed. This backtester lets you test three variations of that idea across different lookback periods to see how they would have performed on any individual stock.
                  </p>

                  <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">The Three Strategy Types</h3>

                  <p>
                    <strong>Simple Momentum</strong> compares today's closing price to the close from N days ago. If the current price is higher, and yesterday's close was also above the close from N+1 days ago, the system enters a long position. This two-day confirmation filter helps avoid whipsaws from single-day spikes. The exit uses the same logic in reverse—when price drops below where it was N days prior, you get out. It's a clean, intuitive way to measure whether a stock is trending up or has rolled over.
                  </p>

                  <p>
                    <strong>Standard Donchian</strong> uses channel breakouts. The entry triggers when price closes at the highest level of the past N days—essentially breaking out of a consolidation range. The exit triggers when price closes at the lowest level of the past M days. Donchian channels were popularized by the famous Turtle Traders in the 1980s and remain a staple of systematic trend-following today. The asymmetry between entry and exit lookbacks (for example, 200-day high entry with 50-day low exit) is intentional—it lets winning trades run longer while cutting losses relatively quickly.
                  </p>

                  <p>
                    <strong>Time-Based Exit</strong> uses the same Donchian-style entry (N-day highest close) but replaces the price-based exit with a time stop. If the stock fails to make a new closing high within M days of the last one, the position is closed. This approach works well in strongly trending markets where pullbacks are shallow—you stay in as long as the stock keeps grinding higher. But if momentum stalls, you exit before waiting for a full reversal. It's a more aggressive way to lock in gains from momentum bursts.
                  </p>

                  <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">Understanding the Results</h3>

                  <p>
                    The equity curve at the top shows the growth of a hypothetical $1,000 investment over time, plotted on a logarithmic scale. Log scale is important for long backtests because it shows percentage moves proportionally—a 50% gain looks the same size whether it happens at $1,000 or $100,000. The Performance Summary table breaks down key metrics: total return, maximum drawdown (the worst peak-to-trough decline), and win rate. Pay attention to the "after Win" and "after Loss" statistics—they reveal whether the strategy exhibits streaky behavior, where wins tend to cluster together or losses compound.
                  </p>

                  <p>
                    The Yearly Performance table shows returns broken down by calendar year, along with how many trades occurred and the win rate for each year. This helps you spot whether the strategy's edge is consistent across different market regimes or concentrated in a few outlier years. A strategy that made 80% of its gains in 1999 and 2020 tells a very different story than one that ground out steady profits every year. The Trade Log at the bottom lists every individual trade with entry and exit prices, so you can audit exactly what the system did and when.
                  </p>

                  <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">Execution Assumptions and Costs</h3>

                  <p>
                    All trades in this backtester execute at the next day's opening price. When a signal triggers on Day 1's close, the simulated trade enters at Day 2's open. This is more realistic than assuming you could trade at the close—by the time you see the closing price, the market is already closed. Exits work the same way. Every trade also includes a 0.10% round-trip commission to approximate real-world costs including spreads and broker fees. The system assumes full reinvestment of profits, so position sizes grow as the equity curve rises. This compounds both gains and losses.
                  </p>

                  <p>
                    Keep in mind that backtested results are hypothetical. They show what would have happened if you had followed the rules perfectly with no slippage, no missed fills, and no emotional interference. Real trading is messier. Use these results as a starting point for understanding how trend-following behaves on different stocks, not as a prediction of future returns. The best strategies are ones you understand well enough to stick with through the inevitable drawdowns.
                  </p>
                </div>
              </section>
            </div>
          )}
        </main>
      </div>
    </>
  );
}