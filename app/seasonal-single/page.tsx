"use client";

import { useState, useEffect } from 'react';
import Head from 'next/head';
import { createClient } from '@supabase/supabase-js';
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

    const [targetDay, setTargetDay] = useState<number>(0); 

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

    // 1. Fetch Symbol List & Calculate Target Day
    useEffect(() => {
        const fetchInitData = async () => {
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
        <>
            {/* SEO Meta Tags */}
            <Head>
                <title>Stock Seasonality Analysis | Historical Trading Day Patterns & Win Rates</title>
                <meta 
                    name="description" 
                    content="Analyze seasonal patterns in individual stocks. See historical average returns and win rates for each trading day of the year across multiple holding periods." 
                />
                <meta name="keywords" content="stock seasonality, trading day patterns, seasonal analysis, historical returns, win rate, calendar effects, stock market patterns" />
                <meta name="robots" content="index, follow" />
            </Head>

            <div 
                className="p-8 max-w-[1600px] mx-auto min-h-screen bg-white"
                style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' } as React.CSSProperties}
            >
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
                                className="block appearance-none w-full bg-gray-50 border border-gray-300 text-gray-900 py-3 px-4 pr-8 rounded leading-tight focus:outline-none focus:bg-white focus:border-gray-500"
                                disabled={symbolList.length === 0}
                            >
                                {symbolList.length === 0 && <option>Loading symbols...</option>}
                                {symbolList.map((sym) => (
                                    <option key={sym} value={sym}>{sym}</option>
                                ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                                </svg>
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
                            <SeasonalTable 
                                data={data} 
                                columns={pctProfitableColumns} 
                                colorScaleType="profitable" 
                                highlightDay={targetDay} 
                            />
                        </section>

                        {/* --- EDUCATIONAL CONTENT SECTION --- */}
                        <section className="mt-12 bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                            <h2 className="text-xl font-bold text-gray-900 mb-4">Understanding Seasonal Patterns in Stocks</h2>
                            
                            <div className="prose prose-gray max-w-none text-gray-700 space-y-4">
                                <p>
                                    Seasonality refers to recurring patterns in stock performance that tend to appear around the same time each year. These patterns emerge from a mix of factors: fund manager behavior around quarter-ends, tax-loss selling in December, earnings season clustering, holiday effects, and even weather-related impacts on certain industries. While no pattern repeats perfectly, studying historical seasonality can help you identify time periods when a stock has historically shown strength or weakness—giving you one more data point for timing decisions.
                                </p>

                                <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">How to Read the Heatmaps</h3>

                                <p>
                                    The tables above show every trading day of the year (approximately 252 days) as rows, with holding periods from 1 to 20 days as columns. The <strong>Average Return Heatmap</strong> shows what the mean return would have been if you bought at the open on that trading day and held for the specified number of days. Green cells indicate positive average returns; red cells indicate negative. The deeper the color, the stronger the historical pattern.
                                </p>

                                <p>
                                    The <strong>Win Rate Heatmap</strong> shows the percentage of times that trade would have been profitable. A win rate of 60% means that out of all the years in the sample, 60% of the trades starting on that day ended with a gain. High win rates combined with strong average returns represent the most historically consistent opportunities. A high average return with a low win rate might indicate a pattern driven by a few outlier years rather than consistent behavior.
                                </p>

                                <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">The Trading Day Numbering System</h3>

                                <p>
                                    Rather than using calendar dates, this tool uses trading day numbers from 1 to 252 (the approximate number of trading days in a year). This approach normalizes for the fact that weekends and holidays shift around the calendar. Trading Day #1 is the first trading day of the year, Trading Day #252 is typically the last. The "Date" column shows an example calendar date for reference, but the pattern is anchored to the trading day number, not the specific date. This means if you're looking at Trading Day #45, you're seeing the pattern for the 45th trading day of the year, regardless of whether that falls on February 28th or March 1st in any given year.
                                </p>

                                <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">What the Highlighted Row Means</h3>

                                <p>
                                    The highlighted row represents the next upcoming trading day based on the most recent data in the system. If today is Trading Day #100, the highlighted row shows Trading Day #101—giving you a forward-looking view of what historical patterns suggest for tomorrow. This makes it easy to quickly find the relevant data without scrolling through hundreds of rows. The highlight updates automatically as new trading days are recorded in the database.
                                </p>

                                <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">Commissions and Realistic Expectations</h3>

                                <p>
                                    All return figures include a 0.10% round-trip commission deduction. This approximates real-world trading costs including spreads and broker fees. A pattern that shows 0.15% average return is actually quite small after costs—you'd need significant position sizes for it to matter, and slippage could easily wipe out the edge. Patterns showing 0.5% or higher average returns with win rates above 55% are more interesting from a practical standpoint, though even these are no guarantee of future performance.
                                </p>

                                <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">Using Seasonality Wisely</h3>

                                <p>
                                    Seasonal patterns are tendencies, not certainties. A trading day that has been positive 70% of the time over the past 20 years can still be negative this year. Markets evolve, and patterns that existed in the past can weaken or disappear as more participants become aware of them. Use this data as one input among many—not as a standalone trading system. It's most valuable when combined with other analysis: if the chart looks bullish, fundamentals are solid, and seasonality is favorable, that's a stronger case than any single factor alone.
                                </p>

                                <p>
                                    Pay attention to the number of years in the sample. A pattern based on 25 years of data is more statistically meaningful than one based on 5 years. Also consider whether the stock's character has changed over time—a company that was a small-cap growth stock 15 years ago and is now a mega-cap dividend payer may not exhibit the same seasonal behavior it once did. The data here is a starting point for research, not a finished answer.
                                </p>
                            </div>
                        </section>
                    </div>
                )}
            </div>
        </>
    );
}