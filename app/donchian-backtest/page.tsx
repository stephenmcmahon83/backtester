"use client";

import React, { useState, useEffect } from 'react';
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

type BacktestResults = {
  dates: string[];
  bnhEquityCurve: number[];
  strategyEquityCurve: number[];
  bnhTotalReturn: number;
  bnhMaxDrawdown: number;
  strategyTotalReturn: number;
  strategyMaxDrawdown: number;
  bullPeriodReturn: number;
  bullPeriodMaxDrawdown: number;
  bearPeriodReturn: number;
  bearPeriodMaxDrawdown: number;
  trades: {
    entryDate: string;
    exitDate: string;
    entryPrice: number;
    exitPrice: number;
    return: number;
  }[];
};

const BacktestChart = ({ data, entryPeriod, exitPeriod }: { data: BacktestResults, entryPeriod: number, exitPeriod: number }) => {
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
        label: `Donchian Strategy (${entryPeriod}/${exitPeriod})`,
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
      title: { display: true, text: 'Equity Curve' },
    },
    scales: { y: { type: 'logarithmic' as const, ticks: { callback: (value: any) => Number(value).toFixed(2) } } }
  };

  return <Line options={options} data={chartData} />;
};

const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`;

export default function DonchianBacktestPage() {
  const [ticker, setTicker] = useState('SPY');
  const [entryPeriod, setEntryPeriod] = useState(50);
  const [exitPeriod, setExitPeriod] = useState(20);
  const [results, setResults] = useState<BacktestResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const periodOptions = Array.from({ length: (200 - 10) / 10 + 1 }, (_, i) => 10 + i * 10);

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

  const handleRunBacktest = async () => {
    if (!ticker) {
      setError("Please enter a ticker symbol.");
      return;
    }
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('donchian-backtest', {
        body: { 
          ticker: ticker.toUpperCase(),
          entryPeriod: entryPeriod,
          exitPeriod: exitPeriod,
        },
      });

      if (invokeError) throw new Error(invokeError.message);
      if (data.error) throw new Error(data.error);

      setResults(data);
    } catch (e: any) {
      console.error("Backtest failed:", e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      id="protected-content"
      className="min-h-screen bg-gray-100 p-4 sm:p-8 font-sans"
      style={{ 
        userSelect: 'none', 
        WebkitUserSelect: 'none', 
        MozUserSelect: 'none', 
        msUserSelect: 'none',
        WebkitTouchCallout: 'none',
      } as React.CSSProperties}
    >
      <main className="container mx-auto max-w-6xl bg-white p-6 rounded-lg shadow-md">
        <h1 className="text-3xl font-bold text-center mb-6 text-gray-800">Donchian Channel Backtester</h1>
        
        <div className="flex flex-wrap justify-center items-center gap-4 mb-8">
          <input
            type="text"
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            placeholder="Enter stock symbol (e.g., SPY)"
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            style={{ userSelect: 'text', WebkitUserSelect: 'text' } as React.CSSProperties}
          />

          <div className="flex items-center gap-2">
            <label htmlFor="entryPeriod" className="font-medium text-gray-700">Entry:</label>
            <select
              id="entryPeriod"
              value={entryPeriod}
              onChange={(e) => setEntryPeriod(Number(e.target.value))}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white"
            >
              {periodOptions.map(period => <option key={period} value={period}>{period}</option>)}
            </select>
          </div>

            <div className="flex items-center gap-2">
            <label htmlFor="exitPeriod" className="font-medium text-gray-700">Exit:</label>
            <select
              id="exitPeriod"
              value={exitPeriod}
              onChange={(e) => setExitPeriod(Number(e.target.value))}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white"
            >
              {periodOptions.map(period => <option key={period} value={period}>{period}</option>)}
            </select>
          </div>
          
          <button
            onClick={handleRunBacktest}
            disabled={loading}
            className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-md shadow-sm hover:bg-indigo-700 disabled:bg-gray-400"
          >
            {loading ? 'Running...' : 'Run Backtest'}
          </button>
        </div>

        {error && <p className="text-red-500 text-center font-bold my-4">Error: {error}</p>}

        {results && (
          <div className="space-y-12">
            <div className="p-4 border rounded-lg">
              <BacktestChart data={results} entryPeriod={entryPeriod} exitPeriod={exitPeriod} />
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-4 text-center">Performance Summary</h2>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Metric</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Buy &amp; Hold</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Donchian Strategy</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Bull Mode Only</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Bear Mode Only</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  <tr>
                    <td className="px-6 py-4 font-medium">Total Return</td>
                    <td className="px-6 py-4 text-right">{formatPercent(results.bnhTotalReturn)}</td>
                    <td className="px-6 py-4 text-right">{formatPercent(results.strategyTotalReturn)}</td>
                    <td className="px-6 py-4 text-right">{formatPercent(results.bullPeriodReturn)}</td>
                    <td className="px-6 py-4 text-right">{formatPercent(results.bearPeriodReturn)}</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 font-medium">Max Drawdown</td>
                    <td className="px-6 py-4 text-right text-red-600">{formatPercent(results.bnhMaxDrawdown)}</td>
                    <td className="px-6 py-4 text-right text-red-600">{formatPercent(results.strategyMaxDrawdown)}</td>
                    <td className="px-6 py-4 text-right text-red-600">{formatPercent(results.bullPeriodMaxDrawdown)}</td>
                    <td className="px-6 py-4 text-right text-red-600">{formatPercent(results.bearPeriodMaxDrawdown)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <div>
              <h2 className="text-2xl font-bold mb-4 text-center">Trade Log</h2>
              <div className="overflow-auto h-[60vh] border rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entry Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Exit Date</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Return</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {results.trades
                      .slice()
                      .reverse()
                      .map((trade, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap">{trade.entryDate}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{trade.exitDate}</td>
                          <td className={`px-6 py-4 whitespace-nowrap text-right font-medium ${trade.return >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatPercent(trade.return)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* --- EDUCATIONAL CONTENT SECTION --- */}
            <section className="mt-12 bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">How the Donchian Channel Strategy Works</h2>
              
              <div className="prose prose-gray max-w-none text-gray-700 space-y-4">
                <p>
                  The Donchian Channel is one of the oldest and most respected trend-following indicators in trading. Developed by Richard Donchian in the 1960s, it was later made famous by the Turtle Traders—a group of novice traders who were taught a systematic approach to trading and went on to generate hundreds of millions in profits. The concept is elegantly simple: buy when price breaks out to a new high, sell when it breaks down to a new low. The idea is that new highs signal the start of an uptrend worth riding, and new lows signal the trend has reversed.
                </p>

                <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">Entry and Exit Logic</h3>

                <p>
                  The &quot;Entry Period&quot; setting determines how many days the system looks back to find the highest high. If you select 50, the strategy enters a long position when today&apos;s price exceeds the highest price of the last 50 days. This is a breakout—price is doing something it hasn&apos;t done in nearly two months, which often signals the beginning of a sustained move. The &quot;Exit Period&quot; works similarly but in reverse: when price drops to a new low over that lookback window, the position is closed. The classic Turtle setup used a 20-day entry with a 10-day exit, but this backtester lets you experiment with different combinations.
                </p>

                <p>
                  Using a shorter exit period than entry period is a common technique. It creates an asymmetry that lets winners run longer while cutting losers faster. If you enter on a 50-day breakout but exit on a 20-day breakdown, you&apos;re giving the trade plenty of room to breathe during normal pullbacks, but you&apos;ll still get out relatively quickly if the trend genuinely reverses. This asymmetry is one of the key insights that made the original Turtle system so effective.
                </p>

                <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">Understanding the Results</h3>

                <p>
                  The equity curve chart compares the Donchian strategy (in red) against simple buy-and-hold (in blue). Both start at the same value and compound over time on a logarithmic scale. What you&apos;re looking for isn&apos;t just which line ends higher—pay attention to the shape of the curves. A strategy that underperforms buy-and-hold but does so with a much smoother ride and smaller drawdowns might still be preferable depending on your risk tolerance. The whole point of trend following is to capture most of the upside while avoiding the worst of the downside.
                </p>

                <p>
                  The Performance Summary table breaks out returns and drawdowns across four scenarios. &quot;Buy &amp; Hold&quot; is the benchmark—what you&apos;d earn just owning the stock the entire time. &quot;Donchian Strategy&quot; shows the overall performance of the trend-following approach. &quot;Bull Mode Only&quot; isolates the returns earned while the strategy was in a position (during uptrends). &quot;Bear Mode Only&quot; shows what happened during the periods when the strategy was flat and sitting in cash. A good trend-following system should show strong returns in Bull Mode and minimal damage (or even small gains from interest) in Bear Mode.
                </p>

                <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">Max Drawdown and Risk Management</h3>

                <p>
                  The Max Drawdown metric is arguably more important than total return for real-world trading. It tells you the worst peak-to-trough decline you would have experienced at any point during the backtest. A strategy that returns 500% but has an 80% max drawdown is almost untradeable in practice—most people would abandon it long before it recovered. Compare the strategy&apos;s drawdown to buy-and-hold. If the Donchian approach shows a significantly lower max drawdown, it means you&apos;re getting a smoother ride even if the total return is similar or slightly lower. That&apos;s the real value of systematic trend following: it keeps you out of the market during the worst crashes.
                </p>

                <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">Trade Log and Execution</h3>

                <p>
                  The Trade Log at the bottom shows every entry and exit with the corresponding return. Scroll through to get a sense of how long trades typically last and how the wins and losses distribute. Trend-following strategies like this one typically have low win rates—often below 50%—but the average winner is much larger than the average loser. You&apos;ll see plenty of small losses from false breakouts, interspersed with occasional big winners that more than make up for them. That&apos;s the nature of the approach, and understanding it upfront helps you stick with the system during the inevitable losing streaks.
                </p>

                <p>
                  All trades in this backtester execute at realistic prices and include a 0.10% round-trip commission to account for spreads and broker fees. The results assume full reinvestment of profits, so position sizes grow as the account grows. This compounds both gains and losses, which is why long-term results can look dramatically different from short-term performance. Use this tool to explore how different period combinations affect behavior, but remember that past performance—however well-tested—doesn&apos;t guarantee future results.
                </p>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}