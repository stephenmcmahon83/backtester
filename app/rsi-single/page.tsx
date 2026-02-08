"use client";

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type RsiBucketRow = {
    bucket_label: string;
    bucket_low: number;
    count: number;
    avg_ret_1: number;
    avg_ret_2: number;
    avg_ret_3: number;
    avg_ret_5: number;
    avg_ret_10: number;
    win_pct_1: number;
    win_pct_2: number;
    win_pct_3: number;
    win_pct_5: number;
    win_pct_10: number;
};

export default function RsiSinglePage() {
    const [ticker, setTicker] = useState<string>(''); 
    const [symbolList, setSymbolList] = useState<string[]>([]);
    const [rsiPeriod, setRsiPeriod] = useState<'5d' | '10d'>('5d');
    
    const [data, setData] = useState<RsiBucketRow[]>([]);
    const [currentBucket, setCurrentBucket] = useState<number | null>(null);
    const [currentRsiValue, setCurrentRsiValue] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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

    // 1. Fetch Symbol List
    useEffect(() => {
        const fetchSymbols = async () => {
            const { data: symData } = await supabase
                .from('symbols')
                .select('symbol')
                .order('symbol', { ascending: true });

            if (symData && symData.length > 0) {
                const list = symData.map((row: any) => row.symbol);
                setSymbolList(list);
                const defaultSym = list.includes('SPY') ? 'SPY' : list[0];
                setTicker(defaultSym);
            }
        };
        fetchSymbols();
    }, []);

    // 2. Fetch RSI Bucket Data
    useEffect(() => {
        if (!ticker) return;

        const fetchData = async () => {
            setLoading(true);
            setError(null);
            setCurrentBucket(null);
            setCurrentRsiValue(null);
            
            try {
                const { data: responseData, error: functionError } = await supabase.functions.invoke(
                    'calculate-rsi-buckets', 
                    {
                        body: JSON.stringify({ 
                            ticker: ticker.toUpperCase(),
                            rsiPeriod: rsiPeriod 
                        }),
                        headers: { "Content-Type": "application/json" }
                    }
                );

                if (functionError) throw functionError;
                if (!responseData || !responseData.rows) throw new Error("No data returned");

                setData(responseData.rows);
                
                if (responseData.currentBucket !== undefined) {
                    setCurrentBucket(responseData.currentBucket);
                }
                if (responseData.currentRsiValue !== undefined) {
                    setCurrentRsiValue(responseData.currentRsiValue);
                }

            } catch (err: any) {
                console.error("Error fetching data:", err);
                setError(err.message || "An unknown error occurred.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [ticker, rsiPeriod]);

    // 3. Define Columns
    const forwardDays = [1, 2, 3, 5, 10];
    
    const columns: { header: string; accessorKey: string; isNumeric?: boolean; type?: string }[] = [
        { header: 'RSI Bucket', accessorKey: 'bucket_label' },
        { header: 'Trades', accessorKey: 'count' }
    ];

    forwardDays.forEach(d => {
        columns.push({
            header: `+${d}D Avg`,
            accessorKey: `avg_ret_${d}`, 
            isNumeric: true,
            type: 'return'
        });
        columns.push({
            header: `+${d}D Win%`,
            accessorKey: `win_pct_${d}`, 
            isNumeric: true,
            type: 'profitable'
        });
    });

    // Helper to format values
    const formatValue = (value: any, type?: string) => {
        if (value === null || value === undefined) return '-';
        if (type === 'return') {
            const pct = (value * 100).toFixed(2);
            const color = value > 0 ? 'text-green-600' : value < 0 ? 'text-red-600' : 'text-gray-600';
            return <span className={color}>{value > 0 ? '+' : ''}{pct}%</span>;
        }
        if (type === 'profitable') {
            const pct = (value * 100).toFixed(1);
            const color = value >= 0.55 ? 'text-green-600' : value <= 0.45 ? 'text-red-600' : 'text-gray-600';
            return <span className={color}>{pct}%</span>;
        }
        return value;
    };

    // RSI zone label helper
    const getRsiZoneInfo = (bucket: number | null) => {
        if (bucket === null) return null;
        if (bucket < 10) return { label: 'Deeply Oversold', color: 'text-green-700', bg: 'bg-green-50' };
        if (bucket < 30) return { label: 'Oversold', color: 'text-green-600', bg: 'bg-green-50' };
        if (bucket < 70) return { label: 'Neutral', color: 'text-gray-600', bg: 'bg-gray-50' };
        if (bucket < 90) return { label: 'Overbought', color: 'text-red-600', bg: 'bg-red-50' };
        return { label: 'Deeply Overbought', color: 'text-red-700', bg: 'bg-red-50' };
    };

    const zoneInfo = getRsiZoneInfo(currentBucket);

    return (
        <>
            {/* JSON-LD SCHEMA */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "SoftwareApplication",
                        "name": "RSI(2) Bucket Backtester",
                        "applicationCategory": "FinanceApplication",
                        "operatingSystem": "Web",
                        "description": "A tool to backtest stock performance based on RSI(2) oversold and overbought levels.",
                        "offers": {
                            "@type": "Offer",
                            "price": "0",
                            "priceCurrency": "USD"
                        }
                    })
                }}
            />

            <div 
                className="p-8 max-w-[1600px] mx-auto min-h-screen bg-white"
                style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' } as React.CSSProperties}
            >
                <header className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">RSI(2) Bucket Analyzer</h1>
                    <p className="text-gray-500">
                        Backtest performance based on average RSI(2) levels. Results include 0.10% round-trip commission.
                    </p>
                </header>
                
                <div className="mb-8 p-6 bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-end gap-6">
                    {/* Ticker Selector */}
                    <div>
                        <label className="block text-gray-700 text-sm font-bold mb-2">Select Ticker Symbol</label>
                        <div className="relative w-64">
                            <select
                                value={ticker}
                                onChange={(e) => setTicker(e.target.value)}
                                className="block appearance-none w-full bg-gray-50 border border-gray-300 text-gray-900 py-3 px-4 pr-8 rounded leading-tight focus:outline-none focus:bg-white focus:border-blue-500"
                            >
                                {symbolList.map((sym) => (
                                    <option key={sym} value={sym}>{sym}</option>
                                ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                            </div>
                        </div>
                    </div>

                    {/* RSI Period Toggle */}
                    <div>
                        <label className="block text-gray-700 text-sm font-bold mb-2">RSI Average Period</label>
                        <div className="flex rounded-lg overflow-hidden border border-gray-300">
                            <button
                                onClick={() => setRsiPeriod('5d')}
                                className={`px-6 py-3 font-medium transition-colors ${
                                    rsiPeriod === '5d' 
                                        ? 'bg-blue-600 text-white' 
                                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                                }`}
                            >
                                5-Day Avg
                            </button>
                            <button
                                onClick={() => setRsiPeriod('10d')}
                                className={`px-6 py-3 font-medium transition-colors ${
                                    rsiPeriod === '10d' 
                                        ? 'bg-blue-600 text-white' 
                                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                                }`}
                            >
                                10-Day Avg
                            </button>
                        </div>
                    </div>

                    {/* Current RSI Bucket Banner */}
                    {!loading && currentBucket !== null && currentRsiValue !== null && zoneInfo && (
                        <div className={`px-6 py-3 ${zoneInfo.bg} border border-gray-200 rounded-lg shadow-sm flex items-center gap-3`}>
                            <div className="flex flex-col">
                                <span className="text-gray-600 text-sm font-medium">
                                    Current {rsiPeriod === '5d' ? '5D' : '10D'} Avg RSI(2):
                                </span>
                                <div className="flex items-center gap-2">
                                    <span className={`text-2xl font-extrabold ${zoneInfo.color}`}>
                                        {currentRsiValue.toFixed(1)}
                                    </span>
                                    <span className={`text-sm font-medium ${zoneInfo.color}`}>
                                        ({zoneInfo.label})
                                    </span>
                                </div>
                            </div>
                            <div className="ml-4 pl-4 border-l border-gray-300">
                                <span className="text-xs text-gray-500">Bucket</span>
                                <div className="text-lg font-bold text-gray-800">
                                    {currentBucket}-{currentBucket + 5}
                                </div>
                            </div>
                        </div>
                    )}

                    {loading && <span className="mb-3 text-blue-600 text-sm font-medium">Analyzing RSI history...</span>}
                </div>

                {error && <div className="text-red-700 bg-red-100 p-4 rounded mb-6">Error: {error}</div>}

                {!loading && data.length > 0 && (
                    <>
                        <section>
                            <div className="mb-4">
                                <h2 className="text-2xl font-bold text-gray-800">Historical Performance by RSI Bucket</h2>
                                <p className="text-sm text-gray-500 mt-1">
                                    Forward returns after entering at various {rsiPeriod === '5d' ? '5-day' : '10-day'} average RSI(2) levels.
                                </p>
                            </div>
                            
                            {/* Table */}
                            <div className="overflow-auto border border-gray-200 rounded-lg shadow-sm" style={{ maxHeight: '70vh' }}>
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50 sticky top-0 z-10">
                                        <tr>
                                            {columns.map((col) => (
                                                <th 
                                                    key={col.accessorKey} 
                                                    className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider"
                                                >
                                                    {col.header}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {data.map((row) => {
                                            const isHighlighted = currentBucket === row.bucket_low;
                                            return (
                                                <tr 
                                                    key={row.bucket_label} 
                                                    className={`${isHighlighted ? 'bg-blue-50 border-l-4 border-blue-500' : 'hover:bg-gray-50'}`}
                                                >
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-gray-900">
                                                        {row.bucket_label}
                                                        {isHighlighted && (
                                                            <span className="ml-2 text-xs text-blue-600 font-medium">← Current</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 font-mono">
                                                        {row.count}
                                                    </td>
                                                    {forwardDays.map(d => (
                                                        <React.Fragment key={d}>
                                                            <td className="px-4 py-3 whitespace-nowrap text-sm font-mono">
                                                                {formatValue(row[`avg_ret_${d}` as keyof RsiBucketRow], 'return')}
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap text-sm font-mono">
                                                                {formatValue(row[`win_pct_${d}` as keyof RsiBucketRow], 'profitable')}
                                                            </td>
                                                        </React.Fragment>
                                                    ))}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </section>

                        {/* --- EDUCATIONAL CONTENT SECTION --- */}
                        <section className="mt-12 bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                            <h2 className="text-xl font-bold text-gray-900 mb-4">Understanding RSI(2) Bucket Analysis</h2>
                            
                            <div className="prose prose-gray max-w-none text-gray-700 space-y-4">
                                <p>
                                    RSI(2) is a 2-period Relative Strength Index, popularized by Larry Connors as a short-term mean reversion indicator. Unlike the traditional 14-period RSI, RSI(2) is extremely sensitive to recent price action, making it useful for identifying short-term overbought and oversold conditions. This tool buckets the <strong>average</strong> RSI(2) over 5 or 10 days to smooth out daily noise while still capturing momentum extremes.
                                </p>

                                <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">How to Read This Table</h3>

                                <p>
                                    Each row represents a &quot;bucket&quot; of RSI values. For example, the &quot;10-15&quot; bucket includes all days where the average RSI(2) was between 10 and 15. The <strong>Trades</strong> column shows how many times this condition occurred historically. The <strong>+1D Avg</strong> through <strong>+10D Avg</strong> columns show the average return if you bought at the next day&apos;s open and held for that many days. The <strong>Win%</strong> columns show how often the trade was profitable.
                                </p>

                                <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">Mean Reversion: Buying Oversold Stocks</h3>

                                <p>
                                    The classic RSI(2) strategy is to buy when RSI is deeply oversold (typically below 10 or 20) and sell when it rebounds. If the buckets in the 0-10 or 10-20 range show consistently positive returns and high win rates, the stock exhibits mean reversion behavior—it tends to bounce after sharp declines.
                                </p>

                                <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">Momentum: Trading Overbought Stocks</h3>

                                <p>
                                    Conversely, high RSI readings (above 80 or 90) can signal either exhaustion or strong momentum. If the 80-90 and 90-100 buckets show positive forward returns, the stock tends to continue its run (momentum continuation). If they show negative returns, the stock typically pulls back after getting overbought.
                                </p>

                                <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">Why Use 5-Day or 10-Day Averages?</h3>

                                <p>
                                    A single day&apos;s RSI(2) can spike due to one volatile session. By averaging over 5 or 10 days, we filter out noise and identify stocks that have been <strong>persistently</strong> oversold or overbought. A stock with a 5-day average RSI below 10 has been weak all week—not just one day. This provides higher-conviction setups than raw daily readings.
                                </p>

                                <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">Commissions and Realistic Expectations</h3>

                                <p>
                                    All returns shown already include a 0.10% round-trip commission deduction. Strategies that look marginally profitable before costs often break even or lose money after execution friction. The numbers here are designed to give you a realistic view of what&apos;s actually achievable.
                                </p>
                            </div>
                        </section>
                    </>
                )}
            </div>
        </>
    );
}