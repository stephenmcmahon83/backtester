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

    useEffect(() => {
        const fetchDashboardData = async () => {
            setLoading(true);
            setError(null);
            
            try {
                // Sending empty body triggers "All Stocks" mode in the edge function
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
    
    const avgReturnColumns = [
        { header: 'Symbol', accessorKey: 'symbol' },
        { header: 'Current Streak', accessorKey: 'current_streak' },
        { header: 'Hist. Occurrences', accessorKey: 'occurrence_count' },
        ...forwardDays.map(d => ({
            header: `+${d} Day`,
            accessorKey: `avg_ret_${d}`, 
            isNumeric: true,
        })),
    ];

    return (
        <div className="p-8 max-w-[1600px] mx-auto min-h-screen bg-white">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Market Streak Scanner</h1>
                <p className="text-gray-500">
                    Showing current streaks for all stocks and their historical forward returns. 
                    <br/>
                    <span className="text-xs text-gray-400">
                        *Data assumes buying next Open, 0.10% commission. Protected content (copy disabled).
                    </span>
                </p>
            </header>
            
            {loading && <div className="text-center p-10 text-blue-600 font-medium">Scanning market streaks...</div>}
            {error && <div className="text-red-700 bg-red-100 p-4 rounded mb-6">Error: {error}</div>}

            {!loading && data.length > 0 && (
                <section>
                    <StreaksTable 
                        data={data} 
                        columns={avgReturnColumns} 
                        colorScaleType="return" 
                    />
                </section>
            )}
        </div>
    );
}