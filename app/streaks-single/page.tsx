"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { StreaksTable } from '@/components/StreaksTable';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function StreakSinglePage() {
    const [ticker, setTicker] = useState<string>(''); 
    const [symbolList, setSymbolList] = useState<string[]>([]);
    
    const [data, setData] = useState<any[]>([]);
    const [currentStreak, setCurrentStreak] = useState<number | null>(null); // ✅ State for current streak
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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

    // 2. Fetch Streak Data for Ticker
    useEffect(() => {
        if (!ticker) return;

        const fetchData = async () => {
            setLoading(true);
            setError(null);
            setCurrentStreak(null); // Reset
            
            try {
                const { data: responseData, error: functionError } = await supabase.functions.invoke(
                    'calculate-streaks', 
                    {
                        body: JSON.stringify({ ticker: ticker.toUpperCase() }),
                        headers: { "Content-Type": "application/json" }
                    }
                );

                if (functionError) throw functionError;
                if (!responseData || !responseData.rows) throw new Error("No data returned");

                setData(responseData.rows);
                
                // ✅ Update state with current streak from backend
                if (responseData.currentStreak !== undefined) {
                    setCurrentStreak(responseData.currentStreak);
                }

            } catch (err: any) {
                console.error("Error fetching data:", err);
                setError(err.message || "An unknown error occurred.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [ticker]);

    // 3. Define Combined Columns (Interleaved)
    const forwardDays = [1, 2, 3, 5, 10];
    
    const combinedColumns: any[] = [
        { header: 'Streak', accessorKey: 'streak_val' },
        { header: 'Trades', accessorKey: 'count' }
    ];

    forwardDays.forEach(d => {
        combinedColumns.push({
            header: `+${d}D Avg`,
            accessorKey: `avg_ret_${d}`, 
            isNumeric: true,
            type: 'return'
        });
        combinedColumns.push({
            header: `+${d}D Win%`,
            accessorKey: `win_pct_${d}`, 
            isNumeric: true,
            type: 'profitable'
        });
    });

    return (
        <div className="p-8 max-w-[1600px] mx-auto min-h-screen bg-white">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Single Stock Streak Analyzer</h1>
                <p className="text-gray-500">
                    Results based on entering/exiting on the next day's open, and include 0.10% round-trip commission.
                </p>
            </header>
            
            <div className="mb-8 p-6 bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-end gap-6">
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

                {/* ✅ Current Streak Banner */}
                {!loading && currentStreak !== null && (
                    <div className="px-6 py-3 bg-blue-50 border border-blue-200 rounded-lg shadow-sm flex items-center gap-3">
                         <span className="text-blue-600 font-bold text-lg">
                            Current Streak: 
                        </span>
                        <span className={`text-2xl font-extrabold ${currentStreak > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {currentStreak > 0 ? `+${currentStreak}` : currentStreak}
                        </span>
                        <span className="text-xs text-blue-400 font-medium ml-1">
                            (Highlighted in table)
                        </span>
                    </div>
                )}

                {loading && <span className="mb-3 text-blue-600 text-sm font-medium">Analyzing historical streaks...</span>}
            </div>

            {error && <div className="text-red-700 bg-red-100 p-4 rounded mb-6">Error: {error}</div>}

            {!loading && data.length > 0 && (
                <section>
                    <div className="mb-4">
                        <h2 className="text-2xl font-bold text-gray-800">Historical Performance</h2>
                        <p className="text-sm text-gray-500 mt-1">
                            Combined view of average returns and win rates by streak count.
                        </p>
                    </div>
                    {/* ✅ Pass the highlight prop */}
                    <StreaksTable 
                        data={data} 
                        columns={combinedColumns} 
                        highlightVal={currentStreak}
                    />
                </section>
            )}
        </div>
    );
}