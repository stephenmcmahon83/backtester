"use client";

import React, { useState, useEffect } from 'react';
import Script from 'next/script';

// --- Constants ---
const COMMISSION_ROUND_TRIP = 0.0010; // 0.10% deducted from total P&L

// --- Types ---
type PricePoint = { 
  date: string; 
  open: number; 
  close: number; 
  change: '+' | '-' 
};

type StatResult = {
  label: string;
  count: number;
  avg_1d: number; win_1d: number;
  avg_2d: number; win_2d: number;
  avg_5d: number; win_5d: number;
  avg_10d: number; win_10d: number;
};

// --- Helper: Generate Permutations ---
const generatePermutations = (maxLength: number): string[] => {
  let patterns: string[] = [];
  const helper = (current: string, length: number) => {
    if (length === 0) {
      patterns.push(current);
      return;
    }
    helper(current + '+', length - 1);
    helper(current + '-', length - 1);
  };
  for (let i = 1; i <= maxLength; i++) helper("", i);
  return patterns;
};

// --- Helper: Mock Data Generator ---
// In a real app, this would be replaced by a Supabase fetch call
const generateMockHistory = (days: number, ticker: string): PricePoint[] => {
  const data: PricePoint[] = [];
  let prevClose = 100.00; 
  
  // ADJUSTMENT: Add positive drift for bullish stocks
  const isBullish = ['NVDA', 'SPY', 'QQQ', 'MSFT', 'AAPL'].includes(ticker);
  const drift = isBullish ? 0.0005 : 0.0; 

  for (let i = 0; i < days; i++) {
    // 1. Overnight Gap
    const gap = (Math.random() - 0.48) * 0.008 + drift; 
    const open = prevClose * (1 + gap);

    // 2. Intraday Move
    const intraday = (Math.random() - 0.48) * 0.02 + drift; 
    const close = open * (1 + intraday);

    const change = close >= prevClose ? '+' : '-';

    data.push({
      date: new Date(Date.now() - (days - i) * 86400000).toISOString().split('T')[0],
      open,
      close,
      change,
    });

    prevClose = close;
  }
  return data;
};

// --- CORE LOGIC ---
const analyzeHistory = (history: PricePoint[]) => {
  const results: StatResult[] = [];
  
  const permutations = generatePermutations(5); 
  const purePatterns: string[] = [];
  for (let i = 6; i <= 12; i++) {
    purePatterns.push('+'.repeat(i));
    purePatterns.push('-'.repeat(i));
  }
  const patternsToTest = ["ANY", ...permutations, ...purePatterns];
  const historyStr = history.map(h => h.change).join('');

  patternsToTest.forEach(pattern => {
    let count = 0;
    let sum1=0, sum2=0, sum5=0, sum10=0;
    let wins1=0, wins2=0, wins5=0, wins10=0;

    const lookback = pattern === "ANY" ? 0 : pattern.length;

    // Scan History
    for (let i = lookback; i < history.length - 11; i++) {
      let match = false;

      if (pattern === "ANY") {
        match = true;
      } else {
        const seq = historyStr.slice(i - lookback + 1, i + 1);
        if (seq === pattern) match = true;
      }

      if (match) {
        count++;
        
        // --- TRADE EXECUTION ---
        // Buy: Next Open (i + 1)
        const entryPrice = history[i + 1].open; 

        // Sell: Close of Day (i + N)
        const calcTrade = (exitIndex: number) => {
          const exitPrice = history[exitIndex].close;
          const grossReturn = (exitPrice - entryPrice) / entryPrice;
          
          // Deduct Commission
          return grossReturn - COMMISSION_ROUND_TRIP; 
        };

        const r1 = calcTrade(i + 1);
        const r2 = calcTrade(i + 2);
        const r5 = calcTrade(i + 5);
        const r10 = calcTrade(i + 10);

        sum1 += r1; if(r1 > 0) wins1++;
        sum2 += r2; if(r2 > 0) wins2++;
        sum5 += r5; if(r5 > 0) wins5++;
        sum10 += r10; if(r10 > 0) wins10++;
      }
    }

    if (count > 0 || pattern === "ANY") {
      results.push({
        label: pattern,
        count,
        avg_1d: count ? sum1/count : 0, win_1d: count ? wins1/count : 0,
        avg_2d: count ? sum2/count : 0, win_2d: count ? wins2/count : 0,
        avg_5d: count ? sum5/count : 0, win_5d: count ? wins5/count : 0,
        avg_10d: count ? sum10/count : 0, win_10d: count ? wins10/count : 0,
      });
    }
  });

  return results;
};

// --- UI Helpers ---
const formatPct = (n: number) => `${(n * 100).toFixed(2)}%`;
const formatInt = (n: number) => `${Math.round(n * 100)}%`;

const ReturnCell = ({ val }: { val: number }) => (
  <span className={val > 0 ? "text-green-600 font-bold" : val < 0 ? "text-red-600 font-bold" : "text-gray-400"}>
    {formatPct(val)}
  </span>
);

const SequenceBadge = ({ seq }: { seq: string }) => {
  if (seq === "ANY") return <span className="bg-gray-800 text-white text-xs font-bold px-2 py-1 rounded">ALL DAYS</span>;
  return (
    <div className="flex flex-wrap gap-0.5 max-w-[120px]">
      {seq.split('').map((c, i) => (
        <span key={i} className={`w-2.5 h-4 flex items-center justify-center text-[8px] font-bold text-white rounded-sm ${c === '+' ? 'bg-green-500' : 'bg-red-500'}`}>
          {c}
        </span>
      ))}
    </div>
  );
};

export default function StreaksPage() {
  const [ticker, setTicker] = useState('NVDA');
  const [analyzedData, setAnalyzedData] = useState<{ currentTail: string, stats: StatResult[] } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { handleAnalyze(); }, []);

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

  const handleAnalyze = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    
    // Simulate API delay for UX
    setTimeout(() => {
      const history = generateMockHistory(5000, ticker); 
      const stats = analyzeHistory(history);
      const currentTail = history.slice(-12).map(h => h.change).join('');

      setAnalyzedData({ currentTail, stats });
      setLoading(false);
    }, 500);
  };

  const baseline = analyzedData?.stats.find(s => s.label === "ANY");

  // Sort: Length (Short->Long), then by 1D Avg Return
  const streaks = analyzedData?.stats
    .filter(s => s.label !== "ANY")
    .sort((a, b) => {
       if (a.label.length !== b.label.length) return a.label.length - b.label.length;
       return b.avg_1d - a.avg_1d; 
    }) || [];

  return (
    <div 
      className="space-y-6"
      style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' } as React.CSSProperties}
    >
      
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col md:flex-row justify-between items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Single Stock Streak Analyzer</h1>
          <p className="text-gray-500 text-sm mt-1">
            Analyze price action patterns (Up/Down sequences) to find short-term edges.
            <br/>
            <strong>Execution:</strong> Buy Next Open vs Sell N-Day Close.
            <br/>
            <strong>Cost:</strong> 0.10% Commission included.
          </p>
        </div>
        <form onSubmit={handleAnalyze} className="flex gap-2 w-full md:w-auto">
          <input 
            value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none uppercase font-bold text-gray-700 w-32"
            placeholder="TICKER"
            style={{ userSelect: 'text', WebkitUserSelect: 'text' } as React.CSSProperties}
          />
          <button disabled={loading} className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition disabled:opacity-50">
            {loading ? 'Running...' : 'Run Analysis'}
          </button>
        </form>
      </div>

      {analyzedData && baseline && (
        <>
          {/* 1. BASELINE CARD (Unconditional Returns) */}
          <div className="bg-white rounded-lg shadow-sm border border-indigo-100 overflow-hidden">
            <div className="bg-gray-50 px-6 py-3 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wider">Unconditional Baseline (All Days)</h2>
              <span className="text-xs text-gray-400">{baseline.count.toLocaleString()} Trades</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-100">
                {[1, 2, 5, 10].map(d => {
                  const avg = baseline[`avg_${d}d` as keyof StatResult] as number;
                  const win = baseline[`win_${d}d` as keyof StatResult] as number;
                  return (
                    <div key={d} className="p-4 text-center hover:bg-gray-50 transition-colors">
                      <div className="text-xs text-gray-400 mb-1 font-semibold">{d} Day Hold</div>
                      <div className="text-xl"><ReturnCell val={avg} /></div>
                      <div className="text-xs text-gray-500 mt-1">Win: {formatInt(win)}</div>
                    </div>
                  )
                })}
            </div>
          </div>

          {/* 2. CURRENT CONTEXT BANNER */}
          <div className="bg-slate-800 text-white rounded-lg p-6 shadow-md flex flex-col md:flex-row items-center gap-6 border border-slate-700">
            <div className="flex flex-col items-center md:items-start min-w-max">
              <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Current Market Context</div>
              <div className="flex items-center gap-1 bg-slate-900 px-4 py-3 rounded-lg border border-slate-600 shadow-inner">
                {analyzedData.currentTail.slice(-12).split('').map((char, i) => (
                  <span key={i} className={`w-6 h-8 flex items-center justify-center font-bold text-lg rounded ${char === '+' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                    {char}
                  </span>
                ))}
              </div>
            </div>
            <div className="hidden md:block h-12 w-px bg-slate-600"></div>
            <p className="text-slate-300 text-sm text-center md:text-left italic">
              The table below highlights specific patterns that match the tail end of this sequence. 
              <span className="block text-xs text-slate-400 mt-1 not-italic">(e.g. if context ends in "-+", we highlight patterns like "+", "-+", "+-+", etc)</span>
            </p>
          </div>

          {/* --- ADSENSE PLACEHOLDER --- */}
          <div className="w-full h-24 bg-gray-100 border-2 border-dashed border-gray-300 rounded flex items-center justify-center text-gray-400 text-sm">
            <span>Advertisement Space</span>
          </div>

          {/* 3. MAIN TABLE */}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-bold text-gray-500 uppercase tracking-wider">Pattern</th>
                    <th className="px-4 py-3 text-center font-bold text-gray-500 uppercase tracking-wider">Count</th>
                    <th className="px-2 py-3 text-center font-bold text-gray-500 border-l">1D Avg</th>
                    <th className="px-2 py-3 text-center font-bold text-gray-400 text-xs">Win%</th>
                    <th className="px-2 py-3 text-center font-bold text-gray-500 border-l">2D Avg</th>
                    <th className="px-2 py-3 text-center font-bold text-gray-400 text-xs">Win%</th>
                    <th className="px-2 py-3 text-center font-bold text-gray-500 border-l">5D Avg</th>
                    <th className="px-2 py-3 text-center font-bold text-gray-400 text-xs">Win%</th>
                    <th className="px-2 py-3 text-center font-bold text-gray-500 border-l">10D Avg</th>
                    <th className="px-2 py-3 text-center font-bold text-gray-400 text-xs">Win%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {streaks.map((row) => {
                    // Highlight logic
                    const isActive = analyzedData.currentTail.endsWith(row.label);
                    
                    // Filter: Only show significant data or currently active patterns
                    if (row.count < 5 && !isActive) return null;

                    return (
                      <tr key={row.label} className={isActive ? "bg-indigo-50 ring-1 ring-inset ring-indigo-200" : "hover:bg-gray-50 transition-colors"}>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <SequenceBadge seq={row.label} />
                            {isActive && <span className="text-[9px] bg-indigo-600 text-white px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shadow-sm">Active</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-gray-600">{row.count}</td>
                        
                        {/* 1D */}
                        <td className="px-2 py-3 text-center border-l border-gray-100"><ReturnCell val={row.avg_1d} /></td>
                        <td className="px-2 py-3 text-center text-gray-400 text-xs">{formatInt(row.win_1d)}</td>

                        {/* 2D */}
                        <td className="px-2 py-3 text-center border-l border-gray-100"><ReturnCell val={row.avg_2d} /></td>
                        <td className="px-2 py-3 text-center text-gray-400 text-xs">{formatInt(row.win_2d)}</td>

                        {/* 5D */}
                        <td className="px-2 py-3 text-center border-l border-gray-100"><ReturnCell val={row.avg_5d} /></td>
                        <td className="px-2 py-3 text-center text-gray-400 text-xs">{formatInt(row.win_5d)}</td>

                        {/* 10D */}
                        <td className="px-2 py-3 text-center border-l border-gray-100"><ReturnCell val={row.avg_10d} /></td>
                        <td className="px-2 py-3 text-center text-gray-400 text-xs">{formatInt(row.win_10d)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* --- EDUCATIONAL CONTENT SECTION --- */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mt-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">How This Strategy Works</h2>
            
            <div className="prose prose-gray max-w-none text-gray-700 space-y-4">
              <p>
                The Single Stock Streak Analyzer is built around a straightforward concept: markets sometimes exhibit short-term momentum or mean-reversion tendencies based on recent price action. Instead of relying on complex indicators or subjective chart reading, this tool systematically tests every possible combination of up and down day sequences—from a single day pattern all the way through extended 12-day streaks—to see which ones have historically preceded profitable moves.
              </p>

              <p>
                When you run an analysis, the backtester scans through the entire price history and identifies each occurrence of every pattern. For example, if you're looking at a "+-+" pattern (up day, down day, up day), the system finds every instance where that exact sequence occurred. Once a pattern is matched, the strategy assumes you buy the stock at the next day's opening price. This matters because in real trading you can't act on today's close until tomorrow—so the open is a realistic entry point. You then hold for a set number of days (1, 2, 5, or 10), and the system records the return based on the closing price of your exit day.
              </p>

              <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">Understanding the Results</h3>

              <p>
                Each row in the results table shows a specific pattern along with how many times it appeared in the historical data. The "Avg" columns display the average return across all trades for that holding period, and the "Win%" shows the percentage of trades that ended in profit. A pattern with a high average return but a low win rate might be driven by a few big winners, while a pattern with a modest average but a very high win rate tends to grind out consistent small gains. Both can be useful depending on your trading style and risk tolerance.
              </p>

              <p>
                The "Unconditional Baseline" at the top is particularly important. It represents what you'd earn on average if you simply bought the stock at any random open and held for the given period—no pattern required. Comparing individual patterns against this baseline tells you whether the pattern actually provides an edge or if you'd be better off with a simpler buy-and-hold approach. Patterns that significantly outperform the baseline on both average return and win rate are the ones worth paying attention to.
              </p>

              <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">Commissions and Realistic Expectations</h3>

              <p>
                Every result you see already has trading costs baked in. The backtester deducts a flat 0.10% round-trip commission from each trade, which covers the spread and broker fees you'd typically encounter with a retail account. This keeps the numbers grounded in reality—what looks like a winning strategy before costs can easily turn into a losing one after you account for the friction of actually executing trades. If the average return on a pattern barely exceeds zero, it's probably not worth trading in the real world once slippage and other execution issues come into play.
              </p>

              <p>
                Keep in mind that past performance in a backtest doesn't guarantee future results. Markets change, patterns that worked in one regime may stop working in another, and there's always the risk of overfitting—where you find a pattern that worked purely by chance. Use this tool as a starting point for research, not as a black-box signal generator. The best approach is to combine these quantitative insights with your own understanding of the stock and broader market conditions.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}