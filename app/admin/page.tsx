"use client";

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const PYTHON_API_URL = "http://localhost:8000";

export default function AdminPage() {
    const [ticker, setTicker] = useState('');
    const [price, setPrice] = useState('');
    const [status, setStatus] = useState('');
    const [debugLog, setDebugLog] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const log = (msg: string) => setDebugLog(prev => [msg, ...prev]);

    // 1. Fetch Price from Supabase (Just for display & Mkt Cap calc)
    const fetchLatestPrice = async () => {
        if (!ticker) return;
        try {
            const { data, error } = await supabase
                .from('stock_data')
                .select('close, date')
                .eq('symbol', ticker.toUpperCase())
                .order('date', { ascending: false })
                .limit(1)
                .single();
            
            if (data) {
                setPrice(data.close.toString());
                log(`Found existing price in DB: $${data.close}`);
            } else {
                log("No price found in DB. Market Cap will be 0.");
            }
        } catch (err) { console.error(err); }
    };

    // 2. Main Import Function
    const handleAutoImport = async () => {
        if (!ticker) { setStatus("Error: Enter a ticker."); return; }
        
        setIsLoading(true);
        setDebugLog([]); 
        setStatus("Connecting to Python...");

        try {
            // A. Call Python (Financials Only)
            const response = await fetch(`${PYTHON_API_URL}/fetch-valuation-data/${ticker}`);
            
            if (!response.ok) {
                const errJson = await response.json().catch(() => ({ detail: response.statusText }));
                throw new Error(`Python Error: ${errJson.detail || response.statusText}`);
            }

            const apiResult = await response.json();
            
            log(`Received Financials for ${ticker}.`);

            // B. Calculate Market Cap
            const payload = apiResult.data;
            const currentPrice = parseFloat(price) || 0;
            payload.price = currentPrice;
            
            // Find TTM or Latest Year to calculate Market Cap
            const latestData = payload.history.find((h:any) => h.isTTM) || payload.history[0];

            if (latestData && latestData.sharesOutstanding && currentPrice > 0) {
                // NOTE: We do NOT multiply by 1,000,000 here anymore.
                // The Python backend now guarantees "sharesOutstanding" is the raw full number.
                payload.overview.MarketCapitalization = latestData.sharesOutstanding * currentPrice;
            }

            // C. Save to Supabase
            const { error } = await supabase.from('financial_cache').upsert({
                symbol: ticker.toUpperCase(),
                data: payload,
                last_updated: new Date().toISOString()
            });

            if (error) throw error;

            setStatus(`SUCCESS! Updated Financials for ${ticker.toUpperCase()}.`);
            log("Saved to Supabase.");

        } catch (err: any) {
            setStatus(`Error: ${err.message}`);
            log(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto min-h-screen bg-gray-50 font-sans">
            <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-200">
                <h1 className="text-2xl font-bold text-gray-800 mb-6">Admin: Import Financials (SEC)</h1>

                <div className="grid grid-cols-2 gap-6 mb-6">
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">Ticker</label>
                        <input 
                            className="border p-3 rounded w-full font-bold uppercase text-slate-900" 
                            value={ticker} 
                            onChange={e => setTicker(e.target.value)} 
                            onBlur={fetchLatestPrice}
                            placeholder="e.g. AMZN" 
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">DB Price</label>
                        <input className="border p-3 rounded w-full bg-gray-100 text-slate-700" value={price} readOnly placeholder="Auto-fetched" />
                    </div>
                </div>

                <button 
                    onClick={handleAutoImport} 
                    disabled={isLoading || !ticker}
                    className="w-full bg-blue-600 text-white font-bold py-4 rounded hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
                >
                    {isLoading ? 'Fetching from SEC...' : 'Import Data'}
                </button>

                {/* STATUS BAR */}
                {status && (
                    <div className={`mt-6 p-4 rounded-lg text-center font-bold ${status.includes('Error') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
                        {status}
                    </div>
                )}

                <div className="mt-6">
                     <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Process Log</label>
                    <div className="bg-gray-900 text-green-400 p-4 rounded h-48 overflow-y-auto text-xs font-mono">
                        {debugLog.map((line, i) => <div key={i} className="mb-1 border-b border-gray-800 pb-1">{line}</div>)}
                    </div>
                </div>
            </div>
        </div>
    );
}