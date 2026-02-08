"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type RsiScannerRow = {
    symbol: string;
    current_rsi: number;
    current_bucket: string;
    bucket_low: number;
    occurrence_count: number;
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

type SortConfig = {
    key: string;
    direction: 'asc' | 'desc';
} | null;

export default function RsiDashboardPage() {
    const [scannerData, setScannerData] = useState<RsiScannerRow[]>([]);
    const [rsiPeriod, setRsiPeriod] = useState<'5d' | '10d'>('5d');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'current_rsi', direction: 'asc' });

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

    // Fetch scanner data
    useEffect(() => {
        const fetchScannerData = async () => {
            setLoading(true);
            setError(null);
            try {
                const { data, error } = await supabase.functions.invoke('calculate-rsi-buckets', {
                    body: JSON.stringify({ rsiPeriod }),
                    headers: { "Content-Type": "application/json" }
                });
                
                if (error) throw new Error(error.message);
                if (!data || data.length === 0) throw new Error('No data returned from the server.');
                
                setScannerData(data);
            } catch (e: any) {
                console.error("Failed to fetch RSI scanner data:", e);
                setError(e.message);
            } finally {
                setLoading(false);
            }
        };
        fetchScannerData();
    }, [rsiPeriod]);

    // Sorting logic
    const sortedData = useMemo(() => {
        if (!sortConfig) return scannerData;
        return [...scannerData].sort((a, b) => {
            let aValue = a[sortConfig.key as keyof RsiScannerRow];
            let bValue = b[sortConfig.key as keyof RsiScannerRow];
            if (aValue === null || aValue === undefined) return 1;
            if (bValue === null || bValue === undefined) return -1;
            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [scannerData, sortConfig]);

    const requestSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'desc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    // RSI zone helper
    const getRsiZone = (rsi: number) => {
        if (rsi < 10) return { label: 'Deeply Oversold', color: 'bg-green-100 text-green-800' };
        if (rsi < 30) return { label: 'Oversold', color: 'bg-green-50 text-green-700' };
        if (rsi < 70) return { label: 'Neutral', color: 'bg-gray-100 text-gray-700' };
        if (rsi < 90) return { label: 'Overbought', color: 'bg-red-50 text-red-700' };
        return { label: 'Deeply Overbought', color: 'bg-red-100 text-red-800' };
    };

    // Cell styling for heatmap
    const getCellStyle = (value: number, type: 'return' | 'winrate') => {
        if (isNaN(value) || value === null || value === undefined) return {};
        let backgroundColor = '';
        if (type === 'return') {
            if (value > 0) backgroundColor = `rgba(34, 197, 94, ${Math.min(value * 25, 0.7)})`;
            else if (value < 0) backgroundColor = `rgba(239, 68, 68, ${Math.min(Math.abs(value) * 25, 0.7)})`;
        }
        if (type === 'winrate') {
            if (value >= 0.55) backgroundColor = `rgba(34, 197, 94, ${Math.min((value - 0.5) * 2.5, 0.7)})`;
            else if (value <= 0.45) backgroundColor = `rgba(239, 68, 68, ${Math.min((0.5 - value) * 2.5, 0.7)})`;
        }
        return { backgroundColor };
    };

    const formatReturn = (value: number) => {
        if (isNaN(value) || value === null) return '-';
        const pct = (value * 100).toFixed(2);
        return value > 0 ? `+${pct}` : pct;
    };

    const formatWinRate = (value: number) => {
        if (isNaN(value) || value === null) return '-';
        return `${(value * 100).toFixed(0)}`;
    };

    // Summary stats
    const oversoldCount = scannerData.filter(r => r.current_rsi < 30).length;
    const overboughtCount = scannerData.filter(r => r.current_rsi > 70).length;
    const deeplyOversoldCount = scannerData.filter(r => r.current_rsi < 10).length;
    const deeplyOverboughtCount = scannerData.filter(r => r.current_rsi > 90).length;

    const forwardDays = [1, 2, 3, 5, 10];

    return (
        <>
            {/* JSON-LD SCHEMA */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "SoftwareApplication",
                        "name": "RSI Oversold/Overbought Scanner",
                        "applicationCategory": "FinanceApplication",
                        "operatingSystem": "Web",
                        "description": "A quantitative scanner that identifies stocks at RSI extremes with historical performance data.",
                        "offers": {
                            "@type": "Offer",
                            "price": "0",
                            "priceCurrency": "USD"
                        },
                        "featureList": [
                            "RSI(2) Oversold Detection",
                            "RSI(2) Overbought Detection",
                            "Historical Win Rate Analysis",
                            "Forward Return Projections"
                        ]
                    })
                }}
            />

            <div 
                id="protected-content"
                className="p-8 max-w-[1800px] mx-auto min-h-screen bg-white"
                style={{ 
                    userSelect: 'none', 
                    WebkitUserSelect: 'none', 
                    MozUserSelect: 'none', 
                    msUserSelect: 'none',
                    WebkitTouchCallout: 'none',
                } as React.CSSProperties}
            >
                <header className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">RSI(2) Market Scanner</h1>
                    <p className="text-gray-500">
                        Scan all stocks for current RSI levels with historical forward performance for each bucket.
                    </p>
                </header>

                {/* Controls */}
                <div className="mb-8 p-6 bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-end gap-6">
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

                    {/* Summary Stats */}
                    {!loading && scannerData.length > 0 && (
                        <div className="flex gap-4 flex-wrap">
                            <div className="px-4 py-2 bg-green-50 border border-green-200 rounded-lg">
                                <div className="text-xs text-green-600 font-medium">Deeply Oversold (&lt;10)</div>
                                <div className="text-2xl font-bold text-green-700">{deeplyOversoldCount}</div>
                            </div>
                            <div className="px-4 py-2 bg-green-50 border border-green-200 rounded-lg">
                                <div className="text-xs text-green-600 font-medium">Oversold (&lt;30)</div>
                                <div className="text-2xl font-bold text-green-700">{oversoldCount}</div>
                            </div>
                            <div className="px-4 py-2 bg-red-50 border border-red-200 rounded-lg">
                                <div className="text-xs text-red-600 font-medium">Overbought (&gt;70)</div>
                                <div className="text-2xl font-bold text-red-700">{overboughtCount}</div>
                            </div>
                            <div className="px-4 py-2 bg-red-50 border border-red-200 rounded-lg">
                                <div className="text-xs text-red-600 font-medium">Deeply Overbought (&gt;90)</div>
                                <div className="text-2xl font-bold text-red-700">{deeplyOverboughtCount}</div>
                            </div>
                        </div>
                    )}

                    {loading && <span className="text-blue-600 text-sm font-medium">Scanning market RSI levels...</span>}
                </div>

                {error && <div className="text-red-700 bg-red-100 p-4 rounded mb-6">Error: {error}</div>}

                {!loading && !error && scannerData.length > 0 && (
                    <div className="space-y-16">
                        {/* Main Scanner Table */}
                        <section>
                            <div className="mb-4">
                                <h2 className="text-2xl font-bold text-gray-800">Current RSI Levels & Historical Performance</h2>
                                <p className="text-sm text-gray-500 mt-1">
                                    Click any column header to sort. Shows current {rsiPeriod === '5d' ? '5-day' : '10-day'} average RSI(2) and historical forward returns for that bucket. Includes 0.10% round-trip commission.
                                </p>
                            </div>
                            
                            <div className="overflow-auto border border-gray-200 rounded-lg shadow-sm" style={{ maxHeight: '70vh' }}>
                                <table className="min-w-full text-sm text-left text-gray-900 border-collapse">
                                    <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                                        <tr>
                                            {/* Fixed columns */}
                                            <th 
                                                onClick={() => requestSort('symbol')}
                                                className="px-4 py-3 border-b border-gray-200 whitespace-nowrap sticky top-0 left-0 z-30 bg-gray-100 font-bold cursor-pointer hover:bg-gray-200"
                                            >
                                                <div className="flex items-center gap-1">
                                                    Symbol
                                                    {sortConfig?.key === 'symbol' && <span className="text-indigo-600">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>}
                                                </div>
                                            </th>
                                            <th 
                                                onClick={() => requestSort('current_rsi')}
                                                className="px-4 py-3 border-b border-gray-200 whitespace-nowrap sticky top-0 z-20 bg-gray-100 font-bold cursor-pointer hover:bg-gray-200"
                                            >
                                                <div className="flex items-center gap-1 justify-center">
                                                    RSI
                                                    {sortConfig?.key === 'current_rsi' && <span className="text-indigo-600">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>}
                                                </div>
                                            </th>
                                            <th className="px-4 py-3 border-b border-gray-200 whitespace-nowrap sticky top-0 z-20 bg-gray-100 font-bold">
                                                Zone
                                            </th>
                                            <th 
                                                onClick={() => requestSort('occurrence_count')}
                                                className="px-4 py-3 border-b border-r-2 border-gray-300 whitespace-nowrap sticky top-0 z-20 bg-gray-100 font-bold cursor-pointer hover:bg-gray-200"
                                            >
                                                <div className="flex items-center gap-1 justify-center">
                                                    Trades
                                                    {sortConfig?.key === 'occurrence_count' && <span className="text-indigo-600">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>}
                                                </div>
                                            </th>
                                            
                                            {/* Forward return columns */}
                                            {forwardDays.map(d => (
                                                <React.Fragment key={d}>
                                                    <th 
                                                        onClick={() => requestSort(`avg_ret_${d}`)}
                                                        className="px-3 py-3 border-b border-gray-200 whitespace-nowrap sticky top-0 z-20 bg-gray-100 font-bold cursor-pointer hover:bg-gray-200 text-center"
                                                    >
                                                        <div className="flex items-center gap-1 justify-center">
                                                            +{d}D Avg
                                                            {sortConfig?.key === `avg_ret_${d}` && <span className="text-indigo-600">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>}
                                                        </div>
                                                    </th>
                                                    <th 
                                                        onClick={() => requestSort(`win_pct_${d}`)}
                                                        className="px-3 py-3 border-b border-gray-200 whitespace-nowrap sticky top-0 z-20 bg-gray-100 font-bold cursor-pointer hover:bg-gray-200 text-center"
                                                    >
                                                        <div className="flex items-center gap-1 justify-center">
                                                            +{d}D Win%
                                                            {sortConfig?.key === `win_pct_${d}` && <span className="text-indigo-600">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>}
                                                        </div>
                                                    </th>
                                                </React.Fragment>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedData.map((row) => {
                                            const zone = getRsiZone(row.current_rsi);
                                            return (
                                                <tr key={row.symbol} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                                    <td className="px-4 py-2 whitespace-nowrap sticky left-0 z-10 bg-white hover:bg-gray-50 font-bold text-indigo-600">
                                                        {row.symbol}
                                                    </td>
                                                    <td className="px-4 py-2 whitespace-nowrap text-center font-mono font-bold">
                                                        {row.current_rsi.toFixed(1)}
                                                    </td>
                                                    <td className="px-4 py-2 whitespace-nowrap">
                                                        <span className={`px-2 py-1 text-xs font-bold rounded-full ${zone.color}`}>
                                                            {zone.label}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-2 whitespace-nowrap text-center font-mono border-r-2 border-gray-300">
                                                        {row.occurrence_count}
                                                    </td>
                                                    
                                                    {forwardDays.map(d => (
                                                        <React.Fragment key={d}>
                                                            <td 
                                                                className="px-3 py-2 whitespace-nowrap text-center font-mono"
                                                                style={getCellStyle(row[`avg_ret_${d}` as keyof RsiScannerRow] as number, 'return')}
                                                            >
                                                                {formatReturn(row[`avg_ret_${d}` as keyof RsiScannerRow] as number)}
                                                            </td>
                                                            <td 
                                                                className="px-3 py-2 whitespace-nowrap text-center font-mono"
                                                                style={getCellStyle(row[`win_pct_${d}` as keyof RsiScannerRow] as number, 'winrate')}
                                                            >
                                                                {formatWinRate(row[`win_pct_${d}` as keyof RsiScannerRow] as number)}
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
                            <h2 className="text-xl font-bold text-gray-900 mb-4">How to Use the RSI Scanner</h2>
                            
                            <div className="prose prose-gray max-w-none text-gray-700 space-y-4">
                                <p>
                                    This scanner provides a market-wide view of RSI(2) conditions across all tracked stocks. Instead of checking each stock individually, you can instantly see which stocks are at RSI extremes and what the historical forward performance looks like for those conditions.
                                </p>

                                <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">Understanding the Columns</h3>

                                <p>
                                    <strong>RSI</strong> shows the current {rsiPeriod === '5d' ? '5-day' : '10-day'} average RSI(2) for each stock. <strong>Zone</strong> categorizes this into human-readable labels from &quot;Deeply Oversold&quot; (RSI below 10) to &quot;Deeply Overbought&quot; (RSI above 90). <strong>Trades</strong> indicates how many times in history this stock has been in this exact RSI bucket—more trades means more statistical significance.
                                </p>

                                <p>
                                    The <strong>+1D Avg through +10D Avg</strong> columns show the historical average return when buying this stock at this RSI level and holding for that many days. The <strong>Win%</strong> columns show what percentage of those historical trades were profitable. All returns include 0.10% round-trip commission.
                                </p>

                                <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">Finding Mean Reversion Candidates</h3>

                                <p>
                                    For oversold bounce plays, sort by RSI ascending to find the most oversold stocks. Then look for ones with positive average returns and high win rates in the +1D to +5D columns. A stock with RSI below 10 that historically bounces 60%+ of the time with positive average returns is a strong mean reversion candidate.
                                </p>

                                <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">Avoiding Overbought Traps</h3>

                                <p>
                                    Sort by RSI descending to see the most overbought stocks. Check their historical forward returns—if a stock at RSI 90+ typically shows negative returns and low win rates, it may be wise to avoid chasing or even consider taking profits if you own it. However, some momentum stocks continue higher even when overbought—the data will show you which pattern each stock follows.
                                </p>

                                <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">The Summary Stats</h3>

                                <p>
                                    The boxes at the top give you a quick market breadth reading. When many stocks are deeply oversold, the market may be near a short-term bottom. When many are deeply overbought, a pullback may be more likely. These counts help you gauge overall market sentiment through the lens of RSI.
                                </p>
                            </div>
                        </section>
                    </div>
                )}
            </div>
        </>
    );
}