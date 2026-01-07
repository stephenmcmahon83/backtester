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
    const [currentStreak, setCurrentStreak] = useState<number | null>(null);
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

    // 2. Fetch Streak Data for Ticker
    useEffect(() => {
        if (!ticker) return;

        const fetchData = async () => {
            setLoading(true);
            setError(null);
            setCurrentStreak(null);
            
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
        <div 
            className="p-8 max-w-[1600px] mx-auto min-h-screen bg-white"
            style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' } as React.CSSProperties}
        >
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

                {/* Current Streak Banner */}
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
                <>
                    <section>
                        <div className="mb-4">
                            <h2 className="text-2xl font-bold text-gray-800">Historical Performance</h2>
                            <p className="text-sm text-gray-500 mt-1">
                                Combined view of average returns and win rates by streak count.
                            </p>
                        </div>
                        <StreaksTable 
                            data={data} 
                            columns={combinedColumns} 
                            highlightVal={currentStreak}
                        />
                    </section>

                    <section className="mt-12 bg-white rounded-lg border border-gray-200 shadow-sm p-6">
    <h2 className="text-xl font-bold text-gray-900 mb-4">How the Streak Strategy Works</h2>
    
    <div className="prose prose-gray max-w-none text-gray-700 space-y-4">
        <p>
            A streak is simply a run of consecutive up or down days. If a stock closes higher than the previous day, that's a +1 day. String three of those together and you've got a +3 streak. The same logic applies to down days—two consecutive lower closes would be a -2 streak. This tool scans the entire price history of the selected stock, identifies every streak that occurred, and then measures what happened next. The idea is to find out whether certain streak lengths tend to precede predictable moves, either as continuation (momentum) or reversal (mean reversion).
        </p>

        <p>
            When a streak ends, the backtester assumes you enter a long position at the following day's opening price. This is a realistic assumption because you can't act on today's closing data until tomorrow's session. The trade is then held for various forward periods—1, 2, 3, 5, and 10 trading days—and the return is calculated based on the opening price of the exit day. By testing multiple holding periods, you can see whether the edge (if any) shows up immediately or takes a few days to play out, which matters for how you'd actually structure a trade.
        </p>

        <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">Reading the Results Table</h3>

        <p>
            Each row represents a specific streak value. Positive numbers indicate winning streaks (consecutive up days), negative numbers indicate losing streaks (consecutive down days). The "Trades" column shows how many times that exact streak occurred in the historical data—this is your sample size, and it matters. A streak that only happened five times might show a great average return, but that's not statistically meaningful. You want to pay closer attention to streaks with dozens or hundreds of occurrences.
        </p>

        <p>
            The "Avg" columns show the average return across all trades for that streak and holding period. The "Win%" columns show what percentage of those trades ended in profit. These two metrics tell different stories. A high average return with a low win rate suggests a pattern driven by occasional large gains—potentially useful but psychologically difficult to trade. A more modest average with a high win rate points to something steadier and more consistent. Neither is inherently better; it depends on your goals and risk tolerance. You can click on any column header to sort the table by that metric—helpful if you want to quickly find the streaks with the highest win rates or the best average returns across a specific holding period.
        </p>

        <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">Current Streak and Practical Use</h3>

        <p>
            The banner at the top displays the stock's current streak based on the most recent trading data. The corresponding row in the table gets highlighted so you can quickly see the historical performance for that exact scenario. If the stock is currently on a +4 streak, you can immediately check what has happened historically after previous +4 streaks. This gives you a data-driven starting point for thinking about the next trade, though it's never a guarantee—markets can and do behave differently than their past patterns.
        </p>

        <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">Commissions and Realism</h3>

        <p>
            Every return figure you see already includes a 0.10% round-trip commission deduction. This approximates the real-world cost of entering and exiting a position through a typical retail brokerage, including spreads. It's a small number on any single trade, but it adds up fast if you're trading frequently. Strategies that show barely positive returns before costs often turn negative once you account for execution friction, so the numbers here are designed to keep your expectations grounded. If something looks good after costs, it's worth investigating further—but always remember that backtested results represent the past, not a promise about the future.
        </p>
    </div>
</section>
                       
                </>
            )}
        </div>
    );
}