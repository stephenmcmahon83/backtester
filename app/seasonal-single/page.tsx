"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
// Ensure this path points to the component we updated in Step 1
import { SeasonalTable } from '@/components/SeasonalTable'; 

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function SeasonalSinglePage() {
    const [ticker, setTicker] = useState<string>(''); 
    const [symbolList, setSymbolList] = useState<string[]>([]);
    
    const [data, setData] = useState<any[]>([]);
    const [backtestYears, setBacktestYears] = useState<number>(0); 
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // NEW: State to hold the "Current/Next" trading day index to highlight
    const [targetDay, setTargetDay] = useState<number>(0); 

    // 1. Fetch Symbol List & Calculate Target Day
    useEffect(() => {
        const fetchInitData = async () => {
            // A. Get Symbols
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

            // B. Calculate Target Day (Matches your Snapshot Logic)
            // We look at SPY to find the most recent trading day in the DB, then add 1.
            const { data: spyData } = await supabase
                .from('stock_data')
                .select('trading_day_of_year')
                .eq('symbol', 'SPY')
                .order('date', { ascending: false })
                .limit(1)
                .single();
            
            if (spyData) {
                let nextDay = (spyData.trading_day_of_year || 1) + 1;
                if (nextDay > 252) nextDay = 1;
                setTargetDay(nextDay);
            }
        };
        fetchInitData();
    }, []);

    // 2. Fetch Seasonality Data for the specific ticker
    useEffect(() => {
        if (!ticker) return;

        const fetchData = async () => {
            setLoading(true);
            setError(null);
            
            try {
                const { data: responseData, error: functionError } = await supabase.functions.invoke(
                    'calculate-seasonals', 
                    {
                        body: JSON.stringify({ ticker: ticker.toUpperCase() }),
                        headers: { "Content-Type": "application/json" }
                    }
                );

                if (functionError) throw functionError;

                const actualData = responseData?.seasonalityData || responseData;
                const years = responseData?.backtestYears || 0;

                if (!actualData || actualData.length === 0) {
                    setError(`No historical data found for ${ticker}.`);
                    setData([]);
                    setBacktestYears(0);
                } else {
                    setData(actualData);
                    setBacktestYears(years);
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
        // 3. Columns Definition
    const avgReturnColumns = [
        { header: 'Date', accessorKey: 'example_date' },
        { header: 'Day', accessorKey: 'trading_day_of_year' },
        ...Array.from({ length: 20 }, (_, i) => ({
            header: `${i + 1}`,
            accessorKey: `avg_ret_${i + 1}`, 
            isNumeric: true,
        })),
    ];

    const pctProfitableColumns = [
        { header: 'Date', accessorKey: 'example_date' },
        { header: 'Day', accessorKey: 'trading_day_of_year' },
        ...Array.from({ length: 20 }, (_, i) => ({
            header: `${i + 1}`,
            accessorKey: `win_pct_${i + 1}`, 
            isNumeric: true,
        })),
    ];

    return (
        <div className="p-8 max-w-[1600px] mx-auto min-h-screen bg-white">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Stock Seasonality Analysis (Single Ticker)</h1>
                <p className="text-gray-500">Analyze historical performance patterns for any symbol over a 20-day forward lookback period.</p>
            </header>
            
            <div className="mb-8 p-6 bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-end gap-6">
                <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2">Select Ticker Symbol</label>
                    <div className="relative w-64">
                        <select
                            value={ticker}
                            onChange={(e) => setTicker(e.target.value)}
                            className="block appearance-none w-full bg-gray-50 border border-gray-300 text-gray-900 py-3 px-4 pr-8 rounded leading-tight focus:outline-none focus:bg-white focus:border-blue-500"
                            disabled={symbolList.length === 0}
                        >
                            {symbolList.length === 0 && <option>Loading symbols...</option>}
                            {symbolList.map((sym) => (
                                <option key={sym} value={sym}>{sym}</option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                        </div>
                    </div>
                </div>

                {!loading && backtestYears > 0 && (
                     <div className="mb-1 px-4 py-2 bg-blue-50 text-blue-700 rounded-md border border-blue-100 text-sm font-medium">
                        Based on <strong>{backtestYears} years</strong> of historical data. 
                        {targetDay > 0 && <span> Highlighting Trading Day <strong>#{targetDay}</strong></span>}
                     </div>
                )}
                {loading && <span className="mb-3 text-blue-600 text-sm font-medium">Updating analysis...</span>}
            </div>

            {error && <div className="text-red-700 bg-red-100 p-4 rounded mb-6">Error: {error}</div>}

            {!loading && data.length > 0 && (
                <div className="space-y-16">
                    <section>
                        <div className="mb-4">
                            <h2 className="text-2xl font-bold text-gray-800">Average Return Heatmap</h2>
                            <p className="text-sm text-gray-500 mt-1">Average return (net of commissions) for holding {ticker} for N days.</p>
                        </div>
                        {/* PASS THE highlightDay PROP HERE */}
                        <SeasonalTable 
                            data={data} 
                            columns={avgReturnColumns} 
                            colorScaleType="return" 
                            highlightDay={targetDay} 
                        />
                    </section>

                    <section>
                        <div className="mb-4">
                            <h2 className="text-2xl font-bold text-gray-800">Profitability Win Rate (%)</h2>
                            <p className="text-sm text-gray-500 mt-1">Percentage of historical trades that were profitable.</p>
                        </div>
                        {/* PASS THE highlightDay PROP HERE */}
                        <SeasonalTable 
                            data={data} 
                            columns={pctProfitableColumns} 
                            colorScaleType="profitable" 
                            highlightDay={targetDay} 
                        />
                    </section>

                    <article className="mt-16 pt-8 border-t border-gray-200 prose prose-blue max-w-none">
                        <h3 className="text-xl font-bold text-gray-900 mb-4">Methodology & Interpretation</h3>
                        <div className="grid md:grid-cols-2 gap-8 text-gray-600 text-sm leading-relaxed">
                            <div>
                                <h4 className="font-semibold text-gray-800 mb-2">Calculation Logic</h4>
                                <p>We scan the entire historical price database for <strong>{ticker}</strong> (spanning {backtestYears} years). For every trading day of the year, we simulate buying the stock at the close and holding for 1 to 20 days.</p>
                            </div>
                            <div>
                                <h4 className="font-semibold text-gray-800 mb-2">Key Metrics</h4>
                                <ul className="list-disc pl-5 space-y-2">
                                    <li><strong>Avg Return:</strong> Mean return of all historical trades, adjusted for 0.10% round-trip commission.</li>
                                    <li><strong>Win Rate:</strong> Percentage of trades ending in profit (&gt;0%).</li>
                                </ul>
                            </div>
                        </div>
                    </article>
                </div>
            )}
        </div>
    );
}