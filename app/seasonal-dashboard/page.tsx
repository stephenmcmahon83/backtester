"use client";

import React, { useState, useEffect } from 'react';
import { createClient } from "@supabase/supabase-js";
import SnapshotTable from '@/components/SnapshotTable';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function SnapshotPage() {
    const [snapshotData, setSnapshotData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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

    useEffect(() => {
        const fetchSnapshotData = async () => {
            setLoading(true);
            setError(null);
            try {
                const { data, error } = await supabase.functions.invoke('calculate-snapshot');
                if (error) throw new Error(error.message);
                if (!data || data.length === 0) throw new Error('No data returned from the server.');
                
                setSnapshotData(data);
            } catch (e: any) {
                console.error("Failed to fetch snapshot data:", e);
                setError(e.message);
            } finally {
                setLoading(false);
            }
        };
        fetchSnapshotData();
    }, []);

    const avgReturnColumns = [
        { header: 'Ticker', accessorKey: 'ticker' },
        { header: 'Years', accessorKey: 'years_of_data' },
        { header: '-10D', accessorKey: 'avg_trailing_ret_10', isNumeric: true, isTrailing: true },
        { header: '-5D', accessorKey: 'avg_trailing_ret_5', isNumeric: true, isTrailing: true },
        { header: '-1D', accessorKey: 'avg_trailing_ret_1', isNumeric: true, isTrailing: true },
        ...Array.from({ length: 20 }, (_, i) => ({
            header: `+${i + 1}D`,
            accessorKey: `avg_ret_${i + 1}`,
            isNumeric: true,
        })),
    ];

    const pctProfitableColumns = [
        { header: 'Ticker', accessorKey: 'ticker' },
        { header: 'Years', accessorKey: 'years_of_data' },
        ...Array.from({ length: 20 }, (_, i) => ({
            header: `+${i + 1}D`,
            accessorKey: `win_pct_${i + 1}`,
            isNumeric: true,
        })),
    ];

    const targetDay = snapshotData.length > 0 ? snapshotData[0].target_day : '...';

    return (
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
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Market Seasonality Snapshot</h1>
                <p className="text-gray-500">
                    Showing forward return probabilities for the upcoming trading day: <strong>#{targetDay}</strong>
                </p>
            </header>
            
            {loading && <div className="text-center p-10 text-blue-600">Loading market analysis...</div>}
            {error && <div className="text-red-700 bg-red-100 p-4 rounded mb-6">Error: {error}</div>}

            {!loading && !error && snapshotData.length > 0 && (
                <div className="space-y-16">
                    <section>
                        <div className="mb-4">
                            <h2 className="text-2xl font-bold text-gray-800">Average Return Heatmap (%)</h2>
                            <p className="text-sm text-gray-500 mt-1">Trailing returns (most recent 10, 5, 1 day trailing returns) and average historical forward returns for holding N days. Assumes 0.10% roundtrip commissions.</p>
                        </div>
                        <SnapshotTable
                            data={snapshotData}
                            columns={avgReturnColumns}
                            colorScaleType="return"
                        />
                    </section>

                    <section>
                        <div className="mb-4">
                            <h2 className="text-2xl font-bold text-gray-800">Profitability Win Rate (%)</h2>
                            <p className="text-sm text-gray-500 mt-1">Percentage of historical trades that were profitable.</p>
                        </div>
                        <SnapshotTable
                            data={snapshotData}
                            columns={pctProfitableColumns}
                            colorScaleType="profitable"
                        />
                    </section>

                    {/* --- EDUCATIONAL CONTENT SECTION --- */}
                    <section className="mt-12 bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Understanding the Market Snapshot</h2>
                        
                        <div className="prose prose-gray max-w-none text-gray-700 space-y-4">
                            <p>
                                This snapshot provides a market-wide view of seasonal patterns for a single trading day. While the single-ticker seasonality tool shows you all 252 trading days for one stock, this page flips the perspective—showing you all stocks for one specific trading day. It answers the question: &quot;Based on historical patterns, which stocks tend to perform best (or worst) starting from tomorrow?&quot;
                            </p>

                            <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">Trailing vs. Forward Returns</h3>

                            <p>
                                The first table includes both trailing and forward return columns. The <strong>trailing columns (-10D, -5D, -1D)</strong> show how each stock has actually performed over the past 10, 5, and 1 trading days leading into this point. This gives you context about recent momentum—whether the stock is coming into this seasonal window hot, cold, or flat. These are actual recent returns, not historical averages.
                            </p>

                            <p>
                                The <strong>forward columns (+1D through +20D)</strong> show the historical average return if you had bought at the open of this trading day and held for the specified number of days. These are averages across all the years in the sample, not predictions. A +5D return of 0.8% means that historically, buying on this trading day and holding for 5 days produced an average gain of 0.8% after commissions.
                            </p>

                            <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">Reading the Heatmap Colors</h3>

                            <p>
                                Both tables use color coding to help you quickly spot patterns. In the Average Return table, green cells indicate positive historical returns and red cells indicate negative. The deeper the color, the stronger the pattern. In the Win Rate table, the coloring reflects profitability percentage—darker greens indicate higher win rates (more consistent historical profitability), while lighter colors or reds indicate lower win rates.
                            </p>

                            <p>
                                The most actionable setups typically show both strong average returns and high win rates. A stock with a 1.2% average return but only a 45% win rate might be getting that average from a few outlier years with huge gains—less reliable. A stock with a 0.6% average return and a 70% win rate shows a more consistent historical pattern, even if the magnitude is smaller.
                            </p>

                            <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">The Years Column</h3>

                            <p>
                                The &quot;Years&quot; column shows how many years of historical data were used to calculate each stock&apos;s seasonal statistics. More years generally means more statistical significance. A pattern based on 25 years of data is more trustworthy than one based on 5 years. Newer stocks or those with limited trading history will show fewer years—keep this in mind when evaluating the strength of their seasonal patterns.
                            </p>

                            <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">Commissions and Realistic Trading</h3>

                            <p>
                                All forward return figures include a 0.10% round-trip commission deduction. This keeps the numbers grounded in reality—what looks like a 0.20% edge before costs might be barely breakeven after you account for spreads and execution. Patterns with returns well above 0.10% are more likely to remain profitable after real-world friction. The trailing return columns are actual price changes and do not include commission adjustments since they represent what already happened, not a hypothetical trade.
                            </p>

                            <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">Putting It Into Practice</h3>

                            <p>
                                Use this snapshot as a screening tool to identify which stocks have historically favorable seasonality heading into the next trading session. Sort by the holding period that matches your typical trade duration—if you&apos;re a 3-5 day swing trader, focus on those columns. Look for stocks where strong average returns coincide with high win rates and a reasonable sample size (years of data).
                            </p>

                            <p>
                                Remember that seasonality is just one factor. A stock with great seasonal patterns can still drop if the company reports bad earnings or the broader market sells off. The trailing return columns help you see if the stock is already extended in one direction—a stock that&apos;s up 5% in the last 5 days might have already captured the seasonal move, or it might indicate momentum that will continue. Combine this data with your own chart analysis and awareness of upcoming catalysts for the best results.
                            </p>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
}