"use client";

import React, { useState } from 'react';
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

const BacktestChart = ({ data, period }: { data: BacktestResults, period: number }) => {
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
        label: `${period}-Day Strategy`,
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

export default function BacktestPage() {
  const [ticker, setTicker] = useState('SPY');
  const [lookbackPeriod, setLookbackPeriod] = useState(100);
  const [results, setResults] = useState<BacktestResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const periodOptions = Array.from({ length: (200 - 10) / 10 + 1 }, (_, i) => 10 + i * 10);

  const handleRunBacktest = async () => {
    if (!ticker) {
      setError("Please enter a ticker symbol.");
      return;
    }
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('backtest-99day', {
        body: { 
          ticker: ticker.toUpperCase(),
          period: lookbackPeriod,
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
    <div className="min-h-screen bg-gray-100 p-4 sm:p-8 font-sans">
      <main className="container mx-auto max-w-6xl bg-white p-6 rounded-lg shadow-md">
        <h1 className="text-3xl font-bold text-center mb-6 text-gray-800">Relative Strength Backtester</h1>
        
        <div className="flex flex-wrap justify-center items-center gap-4 mb-8">
          <input
            type="text"
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            placeholder="Enter stock symbol (e.g., SPY)"
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
          />
          <div className="flex items-center gap-2">
            <label htmlFor="lookbackPeriod" className="font-medium text-gray-700">Period:</label>
            <select
              id="lookbackPeriod"
              value={lookbackPeriod}
              onChange={(e) => setLookbackPeriod(Number(e.target.value))}
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
              <BacktestChart data={results} period={lookbackPeriod} />
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-4 text-center">Performance Summary</h2>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Metric</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Buy & Hold</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{lookbackPeriod}-Day Strategy</th>
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
          </div>
        )}
      </main>
    </div>
  );
}