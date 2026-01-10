"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { StreaksTable } from '@/components/StreaksTable';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function StreakDashboard() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // --- Enhanced Copy/Paste/Screenshot Protection ---
    useEffect(() => {
        // Prevent right-click context menu
        const handleContextMenu = (e: MouseEvent) => e.preventDefault();
        
        // Prevent keyboard shortcuts (copy, paste, save, select all, view source, dev tools)
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ctrl/Cmd + C, V, X, A, U, S, P (print)
            if (
                (e.ctrlKey || e.metaKey) && 
                ['c', 'v', 'x', 'a', 'u', 's', 'p'].includes(e.key.toLowerCase())
            ) {
                e.preventDefault();
            }
            // F12 (dev tools)
            if (e.key === 'F12') {
                e.preventDefault();
            }
            // Ctrl+Shift+I (dev tools), Ctrl+Shift+J (console), Ctrl+Shift+C (inspect)
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && ['i', 'j', 'c'].includes(e.key.toLowerCase())) {
                e.preventDefault();
            }
            // PrintScreen key (limited effectiveness)
            if (e.key === 'PrintScreen') {
                e.preventDefault();
                navigator.clipboard.writeText('');
            }
        };
        
        // Prevent text selection
        const handleSelectStart = (e: Event) => e.preventDefault();
        
        // Prevent drag
        const handleDragStart = (e: Event) => e.preventDefault();
        
        // Prevent copy event
        const handleCopy = (e: Event) => {
            e.preventDefault();
        };

        // Prevent cut event
        const handleCut = (e: Event) => {
            e.preventDefault();
        };

        // Prevent paste event
        const handlePaste = (e: Event) => {
            e.preventDefault();
        };

        // Blur content when window loses focus (anti-screenshot measure)
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

    useEffect(() => {
        const fetchDashboardData = async () => {
            setLoading(true);
            setError(null);
            
            try {
                const { data: responseData, error: functionError } = await supabase.functions.invoke(
                    'calculate-streaks',
                    { method: 'POST' } 
                );

                if (functionError) throw functionError;
                if (!responseData) throw new Error("No data returned");

                setData(responseData);

            } catch (err: any) {
                console.error("Error fetching data:", err);
                setError(err.message || "An unknown error occurred.");
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    const forwardDays = [1, 2, 3, 5, 10];
    
    const combinedColumns: any[] = [
        { header: 'Symbol', accessorKey: 'symbol' },
        { header: 'Current Streak', accessorKey: 'current_streak' },
        { header: 'Hist. Count', accessorKey: 'occurrence_count' },
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
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Market Streak Scanner</h1>
                <p className="text-gray-500">
                    Showing current streaks for all stocks and their historical forward returns.
                    <br/>
                    <span className="text-xs text-gray-400">
                        Results based on entering/exiting on the next day&apos;s open, and include 0.10% round-trip commission.
                    </span>
                </p>
            </header>
            
            {loading && <div className="text-center p-10 text-blue-600 font-medium">Scanning market streaks...</div>}
            {error && <div className="text-red-700 bg-red-100 p-4 rounded mb-6">Error: {error}</div>}

            {!loading && data.length > 0 && (
                <>
                    <section>
                        <StreaksTable 
                            data={data} 
                            columns={combinedColumns} 
                        />
                    </section>

                    {/* --- EDUCATIONAL CONTENT SECTION --- */}
                    <section className="mt-12 bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">How the Market Streak Scanner Works</h2>
                        
                        <div className="prose prose-gray max-w-none text-gray-700 space-y-4">
                            <p>
                                This scanner gives you a bird&apos;s-eye view of streak activity across the entire market. Rather than analyzing one stock at a time, it pulls every symbol in the database and shows you what kind of streak each one is currently on—along with the historical performance data for that exact streak. If you&apos;re looking for mean-reversion setups after extended losing streaks, or momentum plays following a run of green days, this is where you start.
                            </p>

                            <p>
                                Each row in the table represents a single stock. The &quot;Current Streak&quot; column tells you how many consecutive up or down days that stock has logged heading into the next session. A +5 means five straight days of higher closes; a -3 means three straight days of lower closes. The &quot;Hist. Count&quot; column shows how many times that exact streak length has occurred for that particular stock in the past—basically your sample size. If a stock has only seen a +6 streak twice in its history, the forward return data is interesting but not statistically reliable. Stocks with higher counts give you more confidence that the pattern has repeated enough times to mean something.
                            </p>

                            <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">Understanding the Columns</h3>

                            <p>
                                The numbered columns (+1D, +2D, +3D, +5D, +10D) show what happened after each historical occurrence of that streak. &quot;Avg&quot; is the average return across all those trades, and &quot;Win%&quot; is the percentage that ended in profit. You&apos;ll often notice that short-term returns (1-2 days) behave differently than longer holds (5-10 days). Some streaks show immediate reversals that fade over time; others start slow and build momentum. Scanning across multiple time horizons helps you find the right fit for your trading style.
                            </p>

                            <p>
                                All columns in the table are sortable—just click on any header to reorder the data. This is useful when you want to quickly find the stocks with the most extreme current streaks, the highest historical win rates, or the largest average returns for a particular holding period. Sorting by &quot;+1D Avg&quot; descending, for example, surfaces the stocks that have historically bounced hardest the day after their current streak pattern.
                            </p>

                            <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">Trade Execution and Costs</h3>

                            <p>
                                The backtester assumes you enter at the next day&apos;s opening price after a streak is identified—because in real life, you can&apos;t act on today&apos;s close until tomorrow. Exits are also based on the opening price of the target day. This &quot;open-to-open&quot; methodology is more realistic than close-to-close calculations, which can overstate returns by assuming perfect execution at prices you couldn&apos;t actually get.
                            </p>

                            <p>
                                Every return figure already has a 0.10% round-trip commission baked in. That covers the cost of buying and selling through a typical retail broker, including the bid-ask spread. It&apos;s a small drag on any single trade, but it compounds quickly if you&apos;re trading frequently or chasing tiny edges. If a strategy shows 0.05% average return before costs, it&apos;s underwater in the real world. The numbers here are designed to reflect what you&apos;d actually keep, not theoretical profits that evaporate once you start executing.
                            </p>

                            <h3 className="text-lg font-semibold text-gray-800 mt-6 mb-2">Putting It Into Practice</h3>

                            <p>
                                Use this scanner as a filtering tool, not an auto-trading signal. When you see a stock with a notable streak, strong historical returns, and a decent sample size, that&apos;s worth a closer look—but you should still consider the broader context. Is there an earnings report coming? A sector-wide trend? Unusual volume? The data here tells you what has happened before; your job as a trader is to decide whether the current situation is comparable. Backtested edges are a starting point for research, not a substitute for judgment.
                            </p>
                        </div>
                    </section>
                </>
            )}
        </div>
    );
}