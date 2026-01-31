"use client";

import { useState, useEffect } from 'react';
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

    // --- Enhanced Copy/Paste/Screenshot Protection ---
    useEffect(() => {
        // Prevent right-click context menu
        const handleContextMenu = (e: MouseEvent) => e.preventDefault();
        
        // Prevent keyboard shortcuts
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
        
        // Prevent text selection
        const handleSelectStart = (e: Event) => e.preventDefault();
        
        // Prevent drag
        const handleDragStart = (e: Event) => e.preventDefault();
        
        // Prevent copy/cut/paste
        const handleCopy = (e: Event) => e.preventDefault();
        const handleCut = (e: Event) => e.preventDefault();
        const handlePaste = (e: Event) => e.preventDefault();

        // Blur content when window loses focus (anti-screenshot)
        const handleVisibilityChange = () => {
            const content = document.getElementById('protected-content');
            if (content) {
                if (document.hidden) {
                    content.style.filter = 'blur(10px)';
                } else {
                    content.style.filter = 'none';
                }
            }
        };

        // Prevent printing
        const handleBeforePrint = () => {
            document.body.style.display = 'none';
        };
        const handleAfterPrint = () => {
            document.body.style.display = 'block';
        };

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
            {/* 
              JSON-LD SCHEMA
              Tells Google this is a Calculator Tool.
            */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "SoftwareApplication",
                        "name": "Stock Seasonality Calculator",
                        "applicationCategory": "FinanceApplication",
                        "operatingSystem": "Web",
                        "description": "A free tool to analyze historical seasonality patterns for US stocks like AAPL, TSLA, and NVDA.",
                        "offers": {
                            "@type": "Offer",
                            "price": "0",
                            "priceCurrency": "USD"
                        },
                        "featureList": [
                            "Daily Win Rate Heatmap",
                            "Average Monthly Returns",
                            "Best Day to Buy Analysis"
                        ]
                    })
                }}
            />

            <div 
                id="protected-content"
                className="p-8 max-w-[1600px] mx-auto min-h-screen bg-white"
                style={{ 
                    userSelect: 'none', 
                    WebkitUserSelect: 'none', 
                    MozUserSelect: 'none', 
                    msUserSelect: 'none',
                    WebkitTouchCallout: 'none',
                } as React.CSSProperties}
            >
                <header className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Stock Seasonality Calculator</h1>
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

                        {/* --- EDUCATIONAL CONTENT SECTION (SEO OPTIMIZED) --- */}
                        <section className="mt-12 bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                            <h2 className="text-xl font-bold text-gray-900 mb-4">How to Use the Stock Seasonality Calculator</h2>
                            
                            <div className="prose prose-gray max-w-none text-gray-700 space-y-4">
                                <p>
                                    Seasonality refers to recurring patterns in stock performance that tend to appear around the same time each year. This calculator allows you to analyze historical data for major indices like <strong>SPY (S&P 500)</strong> and <strong>QQQ (Nasdaq 100)</strong>, as well as individual stocks like <strong>Apple (AAPL)</strong>, <strong>Nvidia (NVDA)</strong>, <strong>Tesla (TSLA)</strong>, and <strong>Microsoft (MSFT)</strong>.
                                </p>

                                <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">Analyzing AAPL, NVDA, and TSLA Seasonality</h3>

                                <p>
                                    The tables above show every trading day of the year (approximately 252 days) as rows, with holding periods from 1 to 20 days as columns. 
                                </p>
                                <ul className="list-disc pl-6">
                                    <li><strong>The Average Return Heatmap</strong> shows the mean return if you bought at the open on that trading day.</li>
                                    <li><strong>The Win Rate Heatmap</strong> shows the percentage of times that trade would have been profitable.</li>
                                </ul>
                                <p>
                                    For example, you can select <strong>NVDA</strong> to see if it historically rallies leading into specific months, or check <strong>AAPL</strong> to see if it suffers from post-earnings dips during certain quarters.
                                </p>

                                <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">The Trading Day Numbering System</h3>

                                <p>
                                    Rather than using calendar dates, this tool uses trading day numbers from 1 to 252. This normalizes for weekends and holidays. Trading Day #1 is the first trading day of the year (usually Jan 2-4). The &quot;Date&quot; column provides an example calendar date for reference. This ensures that the <strong>Seasonality Calculator</strong> remains accurate regardless of leap years or holiday shifts.
                                </p>

                                <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">What the Highlighted Row Means</h3>

                                <p>
                                    The highlighted row represents the <strong>next upcoming trading day</strong>. If today is Trading Day #100, the highlighted row shows Trading Day #101. This gives you an instant, forward-looking probability score for tomorrow&apos;s open.
                                </p>

                                <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">Commissions and Realistic Expectations</h3>

                                <p>
                                    All return figures include a 0.10% round-trip commission deduction. We believe a seasonality tool is only useful if it reflects real-world trading costs. A pattern showing 0.15% average return might look good on paper, but after slippage and fees, it may be breakeven. Look for days with average returns &gt; 0.5% and win rates &gt; 60% for high-probability setups.
                                </p>
                            </div>
                        </section>
                    </div>
                )}
            </div>
        </>
    );
}