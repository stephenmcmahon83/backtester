"use client";

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Friendly names for the table headers
const STRATEGY_NAMES: Record<string, string> = {
  'donch_25_25': 'Donch 25/25',
  'donch_50_25': 'Donch 50/25',
  'donch_50_50': 'Donch 50/50',
  'donch_100_50': 'Donch 100/50',
  'donch_200_50': 'Donch 200/50',
  'time_25_10': 'Time 25/10',
  'time_50_20': 'Time 50/20',
  'time_100_20': 'Time 100/20',
  'time_200_20': 'Time 200/20',
  'rsi_2': 'RSI(2) MeanRev',
};

type ScanResult = {
  symbol: string;
  status?: string;
  strategies?: Record<string, string>;
};

const StatusBadge = ({ status }: { status: string }) => {
  let colorClass = "bg-gray-50 text-gray-400"; 
  
  if (status === 'BUY' || status === 'BUY_OPEN') {
    colorClass = "bg-green-100 text-green-700 font-bold border border-green-300";
  } else if (status === 'EXIT' || status === 'SELL_OPEN') {
    colorClass = "bg-red-100 text-red-700 font-bold border border-red-300";
  } else if (status === 'HOLD' || status === 'LONG') {
    colorClass = "bg-blue-50 text-blue-600 border border-blue-100";
  } else if (status === 'INSUFFICIENT_DATA') {
    colorClass = "bg-yellow-50 text-yellow-600 text-[10px]";
  }

  return (
    <span className={`inline-flex items-center justify-center px-2 py-1 rounded text-xs ${colorClass} min-w-[60px] text-center shadow-sm`}>
      {status === 'BUY_OPEN' ? 'BUY' : status === 'SELL_OPEN' ? 'EXIT' : status}
    </span>
  );
};

export default function MarketScannerPage() {
  const [tickers, setTickers] = useState<string[]>([]);
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const isMounted = useRef(true);

  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    const loadSymbols = async () => {
      try {
        const { data, error } = await supabase
            .from('symbols')
            .select('symbol')
            .order('symbol');
        
        if (error) throw error;
        if (data) {
          const syms = data.map((d: any) => d.symbol);
          setTickers(syms);
          runScanner(syms);
        }
      } catch (err) {
        console.error("Failed to load symbols", err);
        setLoading(false);
      }
    };
    loadSymbols();
  }, []);

  const runScanner = async (allTickers: string[]) => {
    setLoading(true);
    const BATCH_SIZE = 10; 
    let processedCount = 0;
    const resultMap = new Map<string, ScanResult>();

    for (let i = 0; i < allTickers.length; i += BATCH_SIZE) {
      if (!isMounted.current) break;

      const batch = allTickers.slice(i, i + BATCH_SIZE);
      
      try {
        const { data, error } = await supabase.functions.invoke('market-scanner', {
          body: { tickers: batch },
        });

        if (!error && data) {
          data.forEach((res: ScanResult) => resultMap.set(res.symbol, res));
          const sortedResults = Array.from(resultMap.values()).sort((a, b) => 
            a.symbol.localeCompare(b.symbol)
          );
          setScanResults(sortedResults);
        }
      } catch (err) {
        console.error("Error scanning batch:", batch, err);
      }

      processedCount += batch.length;
      setProgress(Math.min(100, Math.round((processedCount / allTickers.length) * 100)));
      await new Promise(r => setTimeout(r, 50)); 
    }
    setLoading(false);
  };

  const strategyKeys = scanResults.length > 0 && scanResults[0].strategies 
    ? Object.keys(scanResults[0].strategies) 
    : Object.keys(STRATEGY_NAMES);

  return (
    // MAIN CONTAINER: Fits exact height of viewport under the navbar
    <div className="h-[calc(100vh-64px)] flex flex-col bg-white font-sans text-gray-900">
      
      {/* TOP CONTROLS (Fixed Height) */}
      <div className="flex-shrink-0 border-b border-gray-200 bg-white px-4 py-4 md:px-8 z-50 relative shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
                <h1 className="text-2xl font-extrabold text-gray-900">Market Strategy Scanner</h1>
                <p className="text-sm text-gray-500">
                    Scanning {tickers.length} symbols across {Object.keys(STRATEGY_NAMES).length} strategies.
                </p>
            </div>
            <div className="w-full md:w-1/3">
                <div className="flex justify-between text-xs font-bold text-gray-500 mb-1">
                    <span>Progress</span>
                    <span>{progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                    <div 
                        className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300" 
                        style={{ width: `${progress}%` }}
                    ></div>
                </div>
            </div>
        </div>
      </div>

      {/* 
          TABLE CONTAINER (Flex Grow)
          1. relative: acts as anchor for absolute child
          2. overflow-hidden: hides anything spilling out
      */}
      <div className="flex-1 relative overflow-hidden">
        
        {/* 
            SCROLLABLE AREA 
            1. absolute inset-0: fills the parent perfectly
            2. overflow-auto: THIS is the element that scrolls. Sticky items attach to this.
        */}
        <div className="absolute inset-0 overflow-auto">
            <table className="min-w-full border-collapse">
                <thead className="bg-gray-50">
                    <tr>
                        {/* 
                            TOP-LEFT CORNER
                            Sticky Top + Sticky Left
                            Highest Z-Index (50) to float above everything
                        */}
                        <th 
                            scope="col" 
                            className="sticky top-0 left-0 z-50 bg-gray-100 border-b border-r border-gray-300 px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider shadow-sm"
                        >
                            Symbol
                        </th>
                        
                        {/* 
                            TOP HEADER ROW (Strategy Names)
                            Sticky Top
                            High Z-Index (40) to float above data cells
                        */}
                        {strategyKeys.map((key) => (
                            <th 
                                key={key}
                                scope="col" 
                                className="sticky top-0 z-40 bg-gray-50 border-b border-gray-200 px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider min-w-[120px] shadow-sm"
                            >
                                {STRATEGY_NAMES[key] || key}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200 text-sm">
                    {scanResults.map((row) => (
                        <tr key={row.symbol} className="hover:bg-gray-50">
                            
                            {/* 
                                LEFT COLUMN (Ticker Symbols)
                                Sticky Left
                                Medium Z-Index (30) to float above other data cells when scrolling right
                            */}
                            <td className="sticky left-0 z-30 bg-white border-r border-gray-200 px-6 py-4 whitespace-nowrap font-bold text-gray-900 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                {row.symbol}
                            </td>

                            {/* DATA CELLS */}
                            {strategyKeys.map((key) => {
                                const status = row.strategies ? row.strategies[key] : (row.status || 'N/A');
                                return (
                                    <td key={key} className="px-6 py-4 whitespace-nowrap text-center border-r border-gray-100 last:border-r-0">
                                        <StatusBadge status={status} />
                                    </td>
                                );
                            })}
                        </tr>
                    ))}

                    {/* Loading Skeleton Rows */}
                    {scanResults.length === 0 && loading && (
                        Array.from({ length: 20 }).map((_, i) => (
                            <tr key={i}>
                                <td className="sticky left-0 z-30 bg-white border-r border-gray-200 px-6 py-4">
                                    <div className="h-4 bg-gray-200 rounded w-12 animate-pulse"></div>
                                </td>
                                {Array.from({ length: 9 }).map((_, j) => (
                                    <td key={j} className="px-6 py-4 text-center">
                                        <div className="h-6 bg-gray-100 rounded w-16 mx-auto animate-pulse"></div>
                                    </td>
                                ))}
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
}