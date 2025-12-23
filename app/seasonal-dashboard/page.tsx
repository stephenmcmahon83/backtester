"use client";

import React, { useState, useEffect } from 'react';
import { createClient } from "@supabase/supabase-js";
import SnapshotTable from '@/components/SnapshotTable'; // Your path might differ slightly

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function SnapshotPage() {
    const [snapshotData, setSnapshotData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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

    // --- UPDATED: Added 'isTrailing' flag to trailing columns ---
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
        <div className="p-8 max-w-[1600px] mx-auto min-h-screen bg-white">
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
                </div>
            )}
        </div>
    );
}